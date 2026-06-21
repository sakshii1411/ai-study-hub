/**
 * FlashCardPage.tsx — Production-grade AI Flashcard Game
 * • SM-2 spaced repetition
 * • Keyboard shortcuts
 * • PDF export (print-ready)
 * • CSV export (Excel / Google Sheets / Anki compatible)
 * • Filters PDF cover/header junk before generation
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Gamepad2, RotateCw, FileDown, Trash2,
  ArrowRight, ArrowLeft as ArrowLeftIcon, Loader2,
  CheckCircle, XCircle, MinusCircle, FileText, X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { callAIJson } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface Flashcard { question: string; answer: string; }
interface CardState extends Flashcard { id: number; due: number; interval: number; ease: number; reps: number; }
interface AIResponse { flashcards: Flashcard[]; }

const STORAGE_KEY = "ai-flashcards-global";

const SYSTEM_PROMPT = `You are an expert learning assistant creating high-quality study flashcards.

CRITICAL RULES:
1. Base ALL flashcards STRICTLY on the substantive educational content provided.
2. IGNORE: author names, institution names, page numbers, headers, footers, copyright notices, table of contents, dates, publication info, addresses.
3. Each flashcard must test a specific fact, concept, definition, or principle from the content.
4. Questions must be clear and specific. Answers must be concise (1-3 sentences max).
5. Return ONLY valid JSON — no markdown, no backticks, no extra text.

Format: {"flashcards":[{"question":"...","answer":"..."}]}`;

/** Strip PDF metadata noise before sending to AI */
function cleanExtractedText(text: string): string {
  return text
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (!t || t.length < 8) return false;
      // Skip lines that look like headers/footers/metadata
      if (/^(page\s*\d+|\d+\s*of\s*\d+|©|copyright|all rights reserved|www\.|http|isbn|doi:|published by|edited by|chapter \d+)$/i.test(t)) return false;
      // Skip lines that are just a name (1-4 words, title-cased, no verb/punctuation)
      if (/^[A-Z][a-z]+(\.?\s+[A-Z][a-z]+){0,3}$/.test(t) && !t.includes(",") && t.split(" ").length <= 5) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateFlashcards(rawText: string): Promise<Flashcard[]> {
  const text = cleanExtractedText(rawText);
  if (text.length < 100) throw new Error("Not enough substantive content found. Please paste actual study notes or a content-rich PDF.");

  const data = await callAIJson<AIResponse>(
    `Generate 10–15 high-quality study flashcards from the content below.\nIgnore author names, headers, or metadata — focus only on educational content.\nReturn ONLY JSON: {"flashcards":[{"question":"...","answer":"..."}]}\n\nCONTENT:\n${text.slice(0, 28000)}`,
    SYSTEM_PROMPT
  );
  if (!Array.isArray(data?.flashcards)) throw new Error("AI returned an invalid format. Please try again.");
  const valid = data.flashcards.filter(
    c => typeof c.question === "string" && typeof c.answer === "string"
      && c.question.trim().length > 5 && c.answer.trim().length > 5
      // Filter out any cards that are just names
      && !/^who is|^name of/i.test(c.question) || c.question.includes("?")
  );
  if (valid.length === 0) throw new Error("No valid flashcards generated. Try uploading a text-rich document.");
  return valid;
}

function toCardState(cards: Flashcard[]): CardState[] {
  return cards.map((c, i) => ({ ...c, id: i, due: 0, interval: 1, ease: 2.5, reps: 0 }));
}

function updateCard(card: CardState, quality: 0 | 1 | 2 | 3): CardState {
  const now = Date.now();
  if (quality === 0) return { ...card, interval: 1, due: now + 60_000, reps: 0 };
  const newEase = Math.max(1.3, card.ease + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)));
  const newInterval = card.reps === 0 ? 1 : card.reps === 1 ? 6 : Math.round(card.interval * newEase);
  return { ...card, ease: newEase, interval: newInterval, reps: card.reps + 1, due: now + newInterval * 60_000 };
}

function getNextDue(cards: CardState[]): number {
  const idx = cards.findIndex(c => c.due <= Date.now());
  return idx !== -1 ? idx : 0;
}

function nextDueLabel(cards: CardState[]): string {
  const future = cards.filter(c => c.due > Date.now());
  if (!future.length) return "";
  const soonest = Math.min(...future.map(c => c.due));
  const diff = soonest - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "in less than a minute";
  if (mins < 60) return `in ${mins} minute${mins !== 1 ? "s" : ""}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hour${hrs !== 1 ? "s" : ""}`;
  const days = Math.round(hrs / 24);
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

// ── Export modal ────────────────────────────────────────────────────────────
function ExportModal({ onClose, onPDF, onCSV }: { onClose: () => void; onPDF: () => void; onCSV: () => void; }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-700 w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold dark:text-white">Export Flashcards</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button onClick={() => { onPDF(); onClose(); }}
            className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition text-left">
            <FileDown className="h-6 w-6 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 dark:text-white text-sm">Print-ready PDF</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Question & answer cards, formatted for printing or saving.</p>
            </div>
          </button>

          <button onClick={() => { onCSV(); onClose(); }}
            className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition text-left">
            <FileText className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 dark:text-white text-sm">CSV / Anki Import</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Opens in Excel, Google Sheets. In Anki: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">File → Import → select .csv</span>
              </p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
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
  const [showExportModal, setShowExportModal] = useState(false);

  // Load saved cards
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CardState[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed);
          setViewState("studying");
          setIndex(getNextDue(parsed));
          toast.info(`Resumed ${parsed.length} saved flashcards.`);
        }
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => { setIsFlipped(false); }, [index]);

  // Keyboard shortcuts
  useEffect(() => {
    if (viewState !== "studying") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
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

  const handleExportPDF = () => {
    if (!cards.length) return;
    try {
      const doc = new jsPDF();
      const margin = 15;
      const cardWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const cardH = 52;
      const pageH = doc.internal.pageSize.getHeight();
      let y = margin;

      doc.setFontSize(14).setFont("helvetica", "bold").setTextColor(30, 30, 30);
      doc.text("Study Flashcards", margin, y); y += 10;
      doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(150);
      doc.text(`${cards.length} cards · Generated by AI Study Hub`, margin, y); y += 10;

      cards.forEach((card, i) => {
        if (y + cardH * 2 + 24 > pageH - margin) { doc.addPage(); y = margin; }
        // Question
        doc.setFontSize(8).setTextColor(130).setFont("helvetica", "normal");
        doc.text(`CARD ${i + 1} — QUESTION`, margin, y); y += 5;
        doc.setFillColor(248, 250, 252).setDrawColor(200, 200, 220);
        doc.roundedRect(margin, y, cardWidth, cardH, 3, 3, "FD");
        doc.setFontSize(10).setTextColor(30).setFont("helvetica", "bold");
        doc.text(doc.splitTextToSize(card.question, cardWidth - 10), margin + 5, y + 10);
        y += cardH + 5;
        // Answer
        doc.setFontSize(8).setTextColor(130).setFont("helvetica", "normal");
        doc.text(`CARD ${i + 1} — ANSWER`, margin, y); y += 5;
        doc.setFillColor(79, 70, 229).setDrawColor(79, 70, 229);
        doc.roundedRect(margin, y, cardWidth, cardH, 3, 3, "FD");
        doc.setFontSize(10).setTextColor(255).setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(card.answer, cardWidth - 10), margin + 5, y + 10);
        y += cardH + 12;
      });
      doc.save("flashcards.pdf");
      toast.success("PDF downloaded! 📄");
    } catch { toast.error("PDF export failed."); }
  };

  const handleExportCSV = () => {
    if (!cards.length) return;
    // UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF";
    const rows = ["Question,Answer", ...cards.map(c =>
      `"${c.question.replace(/"/g, '""')}","${c.answer.replace(/"/g, '""')}"`
    )].join("\n");
    const blob = new Blob([BOM + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "flashcards.csv";
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV downloaded! Open in Excel or import into Anki.");
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCards([]); setIndex(0); setNotesInput(""); setPdfExtracted(""); setViewState("input");
    toast.info("Flashcards cleared.");
  };

  const dueNow = cards.filter(c => c.due <= Date.now()).length;
  const pct = sessionTotal === 0 ? 0 : Math.round((sessionCorrect / Math.max(cards.length, 1)) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20 dark:from-gray-950 dark:via-indigo-950/30 dark:to-purple-950/20">
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} onPDF={handleExportPDF} onCSV={handleExportCSV} />
      )}

      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">Flashcard Game</h2>
          {viewState === "studying" && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 font-medium">
              {sessionCorrect}/{sessionTotal} correct · {dueNow} due
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-16 w-16 text-indigo-500 animate-spin" />
            <p className="text-indigo-700 dark:text-indigo-300 font-semibold text-lg">Generating flashcards…</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Filtering content and creating cards</p>
          </div>
        )}

        {/* Input screen */}
        {viewState === "input" && !isLoading && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Gamepad2 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">AI Flashcard Game</h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Paste notes or upload a PDF — cards are generated from actual content only.</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Space = flip · 1–4 = rate · ← → = navigate</p>
            </div>

            <Card className="shadow-md dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="border-b dark:border-gray-700 p-0">
                <div className="flex px-4 pt-2">
                  {(["text", "upload"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab ? "text-indigo-600 border-indigo-600" : "text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300"}`}>
                      {tab === "text" ? "✏️ Enter Text / Topic" : "📄 Upload PDF"}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {activeTab === "text" && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Paste notes or type a topic:</Label>
                      <Button variant="link" size="sm" onClick={() => setNotesInput("")} className="text-indigo-600 h-auto px-0">Clear</Button>
                    </div>
                    <Textarea rows={8} value={notesInput} onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="Paste your study notes here, or type a topic like 'Photosynthesis' or 'French Revolution'…"
                      className="dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                )}
                {activeTab === "upload" && (
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload PDF:</Label>
                    <PDFUploader
                      onExtracted={(text) => { setPdfExtracted(text); toast.success("PDF extracted! Ready to generate."); }}
                      onError={() => {}}
                      onReset={() => setPdfExtracted("")}
                    />
                    {pdfExtracted && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                        ✓ {pdfExtracted.length.toLocaleString()} characters extracted
                      </p>
                    )}
                  </div>
                )}
                <Button onClick={handleGenerate}
                  disabled={(activeTab === "upload" ? !pdfExtracted : !notesInput.trim()) || isLoading}
                  className="mt-5 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  ✨ Generate Flashcards
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Studying screen */}
        {viewState === "studying" && !isLoading && cards.length > 0 && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{pct}%</span>
            </div>

            <Card className="shadow-lg border-indigo-100 dark:border-indigo-900 border-2 mb-6 overflow-hidden min-h-[380px] flex flex-col dark:bg-gray-900">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-center p-4">
                <CardTitle className="text-lg">Card {index + 1} of {cards.length}</CardTitle>
              </CardHeader>

              <CardContent className="flex-grow flex items-center justify-center p-6">
                <div className="w-full max-w-lg mx-auto" style={{ perspective: "1200px" }}>
                  <div onClick={() => setIsFlipped(f => !f)}
                    style={{
                      transformStyle: "preserve-3d",
                      transition: "transform 0.55s cubic-bezier(0.68,-0.55,0.27,1.55)",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      position: "relative", height: "200px", cursor: "pointer",
                    }}>
                    {/* Front */}
                    <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                      className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-2xl shadow-md p-6 flex flex-col items-center justify-center text-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500">Question</span>
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 leading-snug">{cards[index].question}</p>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click or press Space to reveal</span>
                    </div>
                    {/* Back */}
                    <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}
                      className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md p-6 flex flex-col items-center justify-center text-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Answer</span>
                      <p className="text-base font-medium text-white leading-relaxed">{cards[index].answer}</p>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                <Button variant="outline" size="icon" onClick={() => setIndex(i => Math.max(i - 1, 0))} disabled={index === 0} className="rounded-full dark:border-gray-600">
                  <ArrowLeftIcon className="h-4 w-4" />
                </Button>
                <p className="text-xs text-gray-400 dark:text-gray-500">Space = flip · 1–4 = rate after flip</p>
                <Button variant="outline" size="icon" onClick={() => setIndex(i => Math.min(i + 1, cards.length - 1))} disabled={index === cards.length - 1} className="rounded-full dark:border-gray-600">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>

            {/* Grading buttons */}
            {isFlipped && (
              <div className="mb-6">
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-3 font-semibold uppercase tracking-widest">How well did you know it?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Again", key: "1", quality: 0 as const, icon: XCircle, color: "text-red-500", border: "border-red-200 dark:border-red-800", hover: "hover:bg-red-50 dark:hover:bg-red-950" },
                    { label: "Hard",  key: "2", quality: 1 as const, icon: MinusCircle, color: "text-orange-500", border: "border-orange-200 dark:border-orange-800", hover: "hover:bg-orange-50 dark:hover:bg-orange-950" },
                    { label: "Good",  key: "3", quality: 2 as const, icon: CheckCircle, color: "text-blue-500", border: "border-blue-200 dark:border-blue-800", hover: "hover:bg-blue-50 dark:hover:bg-blue-950" },
                    { label: "Easy",  key: "4", quality: 3 as const, icon: CheckCircle, color: "text-green-500", border: "border-green-200 dark:border-green-800", hover: "hover:bg-green-50 dark:hover:bg-green-950" },
                  ].map(({ label, key, quality, icon: Icon, color, border, hover }) => (
                    <button key={quality} onClick={() => handleGrade(quality)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${border} ${hover} ${color} dark:bg-gray-900`}>
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                      <span className="text-[10px] opacity-50 font-normal">[{key}]</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => setViewState("input")} className="dark:bg-gray-700 dark:text-white">
                <RotateCw className="mr-2 h-4 w-4" /> New Set
              </Button>
              <Button variant="outline" onClick={() => setShowExportModal(true)} className="dark:border-gray-600 dark:text-gray-200">
                <FileDown className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button variant="destructive" onClick={handleClear}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear
              </Button>
            </div>
          </>
        )}

        {/* Done screen */}
        {viewState === "done" && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Session Complete!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-1">
              You got <span className="font-bold text-green-600">{sessionCorrect}</span> of <span className="font-bold">{sessionTotal}</span> correct.
            </p>
            {nextDueLabel(cards) && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">
                Next card due <span className="font-semibold text-indigo-500">{nextDueLabel(cards)}</span>.
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">
              Spaced repetition will resurface cards at the right time.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => { setIndex(getNextDue(cards)); setViewState("studying"); setSessionCorrect(0); setSessionTotal(0); }}>
                Review Again
              </Button>
              <Button variant="outline" onClick={() => setShowExportModal(true)} className="dark:border-gray-600 dark:text-gray-200">
                <FileDown className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button variant="secondary" onClick={() => setViewState("input")} className="dark:bg-gray-700 dark:text-white">
                <RotateCw className="mr-2 h-4 w-4" /> New Set
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FlashCardPage;
