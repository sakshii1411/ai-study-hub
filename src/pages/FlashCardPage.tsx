/**
 * FlashCardPage.tsx — AI Flashcard Game with robust PDF pipeline
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Gamepad2, RotateCw, FileDown, Trash2, ArrowRight, ArrowLeft as ArrowLeftIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { callAIJson } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface Flashcard { question: string; answer: string; }
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

const FlashCardPage: React.FC = () => {
  const navigate = useNavigate();
  const [notesInput, setNotesInput] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewState, setViewState] = useState<"input" | "studying">("input");
  const [activeTab, setActiveTab] = useState<"text" | "upload">("text");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfExtracted, setPdfExtracted] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Flashcard[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed); setViewState("studying");
          toast.info(`Loaded ${parsed.length} saved flashcards.`);
        }
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => { setIsFlipped(false); }, [index]);

  const handleGenerate = async () => {
    const input = (activeTab === "upload" ? pdfExtracted : notesInput).trim();
    if (!input) { toast.error("Please enter text or upload a PDF."); return; }
    setIsLoading(true); setCards([]); setViewState("input");
    try {
      const generated = await generateFlashcards(input);
      setCards(generated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
      setIndex(0); setViewState("studying");
      toast.success(`Generated ${generated.length} flashcards! 🎉`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate flashcards.");
    } finally { setIsLoading(false); }
  };

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

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY); setCards([]); setIndex(0);
    setNotesInput(""); setPdfExtracted(""); setViewState("input");
    toast.info("Flashcards cleared.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <h2 className="text-base font-semibold text-gray-700">Flashcard Game</h2>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-16 w-16 text-indigo-500 animate-spin" />
            <p className="text-indigo-700 font-semibold text-lg">Generating flashcards…</p>
          </div>
        )}

        {viewState === "input" && !isLoading && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Gamepad2 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900">AI Flashcard Game</h1>
              <p className="mt-2 text-gray-500">Generate, study, and export flashcards from your notes.</p>
            </div>

            <Card className="shadow-md mb-4">
              <CardHeader className="border-b p-0">
                <div className="flex px-4 pt-2">
                  {(["text", "upload"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab ? "text-indigo-600 border-indigo-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
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
                      <Label htmlFor="notes-input" className="text-sm font-medium text-gray-700">Enter topic or paste notes:</Label>
                      <Button variant="link" size="sm" onClick={() => setNotesInput("")} className="text-indigo-600 h-auto px-0">Clear</Button>
                    </div>
                    <Textarea id="notes-input" rows={8} value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Paste your study notes here…" />
                  </div>
                )}

                {activeTab === "upload" && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF or text file:</Label>
                    <PDFUploader
                      onExtracted={(text) => { setPdfExtracted(text); toast.success("Text extracted! Ready to generate."); }}
                      onError={() => {}}
                      onReset={() => setPdfExtracted("")}
                    />
                    {pdfExtracted && (
                      <p className="text-xs text-green-700 mt-2">✓ {pdfExtracted.length.toLocaleString()} characters extracted</p>
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
            <Card className="shadow-lg border-indigo-100 border-2 mb-6 overflow-hidden min-h-[380px] flex flex-col">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-center p-4">
                <CardTitle className="text-xl">Card {index + 1} of {cards.length}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-lg mx-auto" style={{ perspective: "1200px" }}>
                  <div onClick={() => setIsFlipped((f) => !f)}
                    style={{ transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.68,-0.55,0.27,1.55)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative", height: "220px", cursor: "pointer" }}
                  >
                    <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                      className="bg-white border rounded-2xl shadow p-6 flex items-center justify-center text-center">
                      <p className="text-lg font-semibold text-gray-800">{cards[index].question}</p>
                    </div>
                    <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}
                      className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow p-6 flex items-center justify-center text-center">
                      <p className="text-base text-white">{cards[index].answer}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between p-4 bg-gray-50 border-t">
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} className="rounded-full">
                  <ArrowLeftIcon className="h-5 w-5" />
                </Button>
                <p className="text-xs text-gray-500">Click card to flip</p>
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => Math.min(i + 1, cards.length - 1))} disabled={index === cards.length - 1} className="rounded-full">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </CardFooter>
            </Card>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => setViewState("input")}><RotateCw className="mr-2 h-4 w-4" /> Create New Set</Button>
              <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
              <Button variant="destructive" onClick={handleClear}><Trash2 className="mr-2 h-4 w-4" /> Clear</Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FlashCardPage;
