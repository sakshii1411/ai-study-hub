/**
 * FlashCardPage.tsx — AI Flashcard Game with Spaced Repetition, Keyboard Shortcuts & Anki Export
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Gamepad2, RotateCw, FileDown, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, Loader2, CheckCircle, XCircle, MinusCircle, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { callAIJson } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface Flashcard { question: string; answer: string; }
/** Spaced repetition: 0=new, 1=hard, 2=good, 3=easy */
interface CardState extends Flashcard { id: number; due: number; interval: number; ease: number; reps: number; }
interface AIResponse { flashcards: Flashcard[]; }

const STORAGE_KEY = "ai-flashcards-global";
const SYSTEM_PROMPT = `You are an expert learning assistant. Create high-quality flashcards from the provided text. Base ALL flashcards strictly on the provided text. Return ONLY valid JSON: {"flashcards":[{"question":"...","answer":"..."}]} No markdown, no backticks.`;

async function generateFlashcards(text: string): Promise<Flashcard[]> {
  const data = await callAIJson<AIResponse>(
    `Generate flashcards from this text. Return ONLY JSON: {"flashcards":[{"question":"...","answer":"..."}]}\n\nTEXT:\n${text.slice(0, 28000)}`,
    SYSTEM_PROMPT
  );
  if (!Array.isArray(data?.flashcards)) throw new Error("AI returned an invalid flashcard format.");
  const valid = data.flashcards.filter((c) => typeof c.question === "string" && typeof c.answer === "string");
  if (valid.length === 0) throw new Error("No valid flashcards were generated. Try providing richer text.");
  return valid;
}

function toCardState(cards: Flashcard[]): CardState[] {
  return cards.map((c, i) => ({ ...c, id: i, due: 0, interval: 1, ease: 2.5, reps: 0 }));
}

/** SM-2 algorithm variant */
function updateCard(card: CardState, quality: 0 | 1 | 2 | 3): CardState {
  const now = Date.now();
  if (quality === 0) return { ...card, interval: 1, due: now + 60_000, reps: 0 };
  const newEase = Math.max(1.3, card.ease + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)));
  const newInterval = card.reps === 0 ? 1 : card.reps === 1 ? 6 : Math.round(card.interval * newEase);
  return { ...card, ease: newEase, interval: newInterval, reps: card.reps + 1, due: now + newInterval * 60_000 };
}

function getNextDue(cards: CardState[]): number {
  const now = Date.now();
  const idx = cards.findIndex(c => c.due <= now);
  return idx !== -1 ? idx : 0;
}

const FlashCardPage: React.FC = () => {
  const navigate = useNavigate();
  const [notesInput, setNotesInput] = useState("");
  const [cards, setCards] = useState<CardState[]>([]);
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewState, setViewState] = useState<"input" | "studying" | "done">("input");
  const [activeTab, setActiveTab] = useState<"text" | "upload">("text");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfExtracted, setPdfExtracted] = useState("");
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CardState[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed); setViewState("studying");
          setIndex(getNextDue(parsed));
          toast.info(`Loaded ${parsed.length} saved flashcards.`);
        }
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => { setIsFlipped(false); }, [index]);

  // Keyboard shortcuts
  useEffect(() => {
    if (viewState !== "studying") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setIsFlipped(f => !f); }
      if (isFlipped) {
        if (e.key === "1") handleGrade(0);
        if (e.key === "2") handleGrade(1);
        if (e.key === "3") handleGrade(2);
        if (e.key === "4") handleGrade(3);
      }
      if (e.key === "ArrowLeft") setIndex(i => Math.max(i - 1, 0));
      if (e.key === "ArrowRight") setIndex(i => Math.min(i + 1, cards.length - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState, isFlipped, cards.length]);

  const handleGenerate = async () => {
    const input = (activeTab === "upload" ? pdfExtracted : notesInput).trim();
    if (!input) { toast.error("Please enter text or upload a PDF."); return; }
    setIsLoading(true); setCards([]); setViewState("input");
    try {
      const generated = await generateFlashcards(input);
      const states = toCardState(generated);
      setCards(states);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
      setIndex(0); setViewState("studying"); setSessionCorrect(0); setSessionTotal(0);
      toast.success(`Generated ${generated.length} flashcards! 🎉`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate flashcards.");
    } finally { setIsLoading(false); }
  };

  const handleGrade = useCallback((quality: 0 | 1 | 2 | 3) => {
    if (!isFlipped) return;
    setSessionTotal(t => t + 1);
    if (quality >= 2) setSessionCorrect(c => c + 1);
    setCards(prev => {
      const updated = [...prev];
      updated[index] = updateCard(updated[index], quality);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    const next = cards.findIndex((c, i) => i !== index && c.due <= Date.now());
    const allDone = cards.every((c, i) => i === index || c.due > Date.now());
    if (allDone) {
      setViewState("done");
    } else {
      setIndex(next !== -1 ? next : (index + 1) % cards.length);
      setIsFlipped(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, index, cards]);

  const handleExport = () => {
    if (cards.length === 0) { toast.error("No flashcards to export."); return; }
    try {
      const doc = new jsPDF();
      const margin = 15; const cardWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const cardH = 55; const pageH = doc.internal.pageSize.getHeight(); let y = margin;
      cards.forEach((card, i) => {
        if (y + cardH * 2 + 20 > pageH - margin) { doc.addPage(); y = margin; }
        doc.setFontSize(9).setTextColor(150);
        doc.text(`Card ${i + 1} — Question`, margin, y);
        doc.setFillColor(255, 255, 255).setDrawColor(220);
        doc.roundedRect(margin, y + 4, cardWidth, cardH, 3, 3, "FD");
        doc.setFontSize(11).setTextColor(50);
        doc.text(doc.splitTextToSize(card.question, cardWidth - 10), margin + 5, y + 14);
        y += cardH + 8;
        doc.setFontSize(9).setTextColor(150);
        doc.text(`Card ${i + 1} — Answer`, margin, y);
        doc.setFillColor(79, 70, 229).setDrawColor(79, 70, 229);
        doc.roundedRect(margin, y + 4, cardWidth, cardH, 3, 3, "FD");
        doc.setFontSize(11).setTextColor(255);
        doc.text(doc.splitTextToSize(card.answer, cardWidth - 10), margin + 5, y + 14);
        y += cardH + 12;
      });
      doc.save("flashcards.pdf"); toast.success("Exported to PDF! 📄");
    } catch (err: unknown) { toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown"}`); }
  };

  /** Export as Anki-compatible TSV (tab-separated: front\tback) */
  const handleExportAnki = () => {
    if (cards.length === 0) { toast.error("No flashcards to export."); return; }
    const tsv = cards.map(c => `${c.question.replace(/\t/g, " ")}\t${c.answer.replace(/\t/g, " ")}`).join("\n");
    const blob = new Blob([tsv], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flashcards-anki.txt";
    a.click(); URL.revokeObjectURL(url);
    toast.success("Anki import file saved! Import via File → Import in Anki.");
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY); setCards([]); setIndex(0);
    setNotesInput(""); setPdfExtracted(""); setViewState("input");
    toast.info("Flashcards cleared.");
  };

  const dueNow = cards.filter(c => c.due <= Date.now()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20 dark:from-gray-950 dark:via-indigo-950/30 dark:to-purple-950/20">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">Flashcard Game</h2>
          {viewState === "studying" && sessionTotal > 0 && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-medium">
              {sessionCorrect}/{sessionTotal} correct · {dueNow} due
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-16 w-16 text-indigo-500 animate-spin" />
            <p className="text-indigo-700 dark:text-indigo-300 font-semibold text-lg">Generating flashcards…</p>
          </div>
        )}

        {viewState === "input" && !isLoading && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Gamepad2 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">AI Flashcard Game</h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Generate, study with spaced repetition, and export flashcards.</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Keyboard: Space/Enter = flip · 1–4 = rate (after flip) · ← → = navigate</p>
            </div>

            <Card className="shadow-md mb-4 dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="border-b dark:border-gray-700 p-0">
                <div className="flex px-4 pt-2">
                  {(["text", "upload"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab ? "text-indigo-600 border-indigo-600" : "text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300"}`}
                    >
                      {tab === "text" ? "Enter Text" : "Upload PDF"}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {activeTab === "text" && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="notes-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">Enter topic or paste notes:</Label>
                      <Button variant="link" size="sm" onClick={() => setNotesInput("")} className="text-indigo-600 h-auto px-0">Clear</Button>
                    </div>
                    <Textarea id="notes-input" rows={8} value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Paste your study notes here…" />
                  </div>
                )}

                {activeTab === "upload" && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload PDF or text file:</Label>
                    <PDFUploader
                      onExtracted={(text) => { setPdfExtracted(text); toast.success("Text extracted! Ready to generate."); }}
                      onError={() => {}}
                      onReset={() => setPdfExtracted("")}
                    />
                    {pdfExtracted && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-2">✓ {pdfExtracted.length.toLocaleString()} characters extracted</p>
                    )}
                  </div>
                )}

                <Button onClick={handleGenerate}
                  disabled={(activeTab === "upload" ? !pdfExtracted : !notesInput.trim()) || isLoading}
                  className="mt-5 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 text-sm"
                >
                  ✨ Generate Flashcards
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {viewState === "studying" && !isLoading && cards.length > 0 && (
          <>
            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6 overflow-hidden">
              <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${sessionTotal === 0 ? 0 : Math.round((sessionCorrect / Math.max(cards.length, 1)) * 100)}%` }} />
            </div>

            <Card className="shadow-lg border-indigo-100 dark:border-indigo-900 border-2 mb-6 overflow-hidden min-h-[380px] flex flex-col dark:bg-gray-900">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-center p-4">
                <CardTitle className="text-xl">Card {index + 1} of {cards.length}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-lg mx-auto" style={{ perspective: "1200px" }}>
                  <div onClick={() => setIsFlipped((f) => !f)}
                    style={{ transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.68,-0.55,0.27,1.55)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative", height: "220px", cursor: "pointer" }}
                  >
                    <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                      className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow p-6 flex items-center justify-center text-center">
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{cards[index].question}</p>
                    </div>
                    <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}
                      className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow p-6 flex items-center justify-center text-center">
                      <p className="text-base text-white">{cards[index].answer}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} className="rounded-full">
                  <ArrowLeftIcon className="h-5 w-5" />
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400">Click or press Space to flip</p>
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => Math.min(i + 1, cards.length - 1))} disabled={index === cards.length - 1} className="rounded-full">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Spaced repetition grading */}
            {isFlipped && (
              <div className="mb-6">
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">How well did you know it?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Again", key: "1", quality: 0 as const, icon: XCircle, color: "text-red-500", bg: "hover:bg-red-50 dark:hover:bg-red-950 border-red-200 dark:border-red-800" },
                    { label: "Hard", key: "2", quality: 1 as const, icon: MinusCircle, color: "text-orange-500", bg: "hover:bg-orange-50 dark:hover:bg-orange-950 border-orange-200 dark:border-orange-800" },
                    { label: "Good", key: "3", quality: 2 as const, icon: CheckCircle, color: "text-blue-500", bg: "hover:bg-blue-50 dark:hover:bg-blue-950 border-blue-200 dark:border-blue-800" },
                    { label: "Easy", key: "4", quality: 3 as const, icon: CheckCircle, color: "text-green-500", bg: "hover:bg-green-50 dark:hover:bg-green-950 border-green-200 dark:border-green-800" },
                  ].map(({ label, key, quality, icon: Icon, color, bg }) => (
                    <button key={quality} onClick={() => handleGrade(quality)}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all font-semibold text-sm ${bg} ${color}`}>
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                      <span className="text-xs opacity-60 font-normal">[{key}]</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => setViewState("input")}><RotateCw className="mr-2 h-4 w-4" /> Create New Set</Button>
              <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
              <Button variant="outline" onClick={handleExportAnki}><Download className="mr-2 h-4 w-4" /> Export Anki</Button>
              <Button variant="destructive" onClick={handleClear}><Trash2 className="mr-2 h-4 w-4" /> Clear</Button>
            </div>
          </>
        )}

        {viewState === "done" && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Session Complete!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2">You answered {sessionCorrect} of {sessionTotal} correctly.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">Cards are scheduled for spaced repetition — come back later for the due ones.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => { setIndex(getNextDue(cards)); setViewState("studying"); setSessionCorrect(0); setSessionTotal(0); }}>
                Review All Again
              </Button>
              <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
              <Button variant="outline" onClick={handleExportAnki}><Download className="mr-2 h-4 w-4" /> Export Anki</Button>
              <Button variant="secondary" onClick={() => setViewState("input")}><RotateCw className="mr-2 h-4 w-4" /> New Set</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FlashCardPage;
