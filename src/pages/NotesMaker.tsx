/**
 * NotesMaker.tsx — Production-ready Notes Maker with robust PDF pipeline
 */
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Clipboard, Check, FileText, Loader2 } from "lucide-react";
import { callAIStream } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { ExtractionResult } from "@/lib/extractFileText";

type NoteType = "Summary" | "Detailed" | "Exam-Focused" | "Flashcards";

const NOTE_TYPES: { value: NoteType; label: string; description: string }[] = [
  { value: "Summary", label: "Summary Notes", description: "High-level overview of the material." },
  { value: "Detailed", label: "Detailed Notes", description: "Comprehensive notes covering every major point." },
  { value: "Exam-Focused", label: "Exam-Focused", description: "Key definitions, formulas & potential exam questions." },
  { value: "Flashcards", label: "Q&A Flashcards", description: "Structured Question-and-Answer pairs for quick revision." },
];

function buildPrompt(topic: string, noteType: NoteType, material: string): string {
  const instructions: Record<NoteType, string> = {
    Summary: `Create a concise, high-level SUMMARY of the study material below.\n- Capture only the core ideas and main conclusions.\n- Use ## headings for sections, bullet points for lists.\n- Keep it brief: aim for 250–400 words.`,
    Detailed: `Create COMPREHENSIVE, DETAILED study notes from the material below.\n- Cover every major point, definition, and sub-topic.\n- Use ## headings, ### sub-headings, and bullet points (*) throughout.\n- Include important quotes or figures exactly as they appear in the material.`,
    "Exam-Focused": `Create EXAM-FOCUSED notes from the material below.\n- Prioritise: key definitions, important formulas, dates, and names.\n- End with 3–5 likely exam questions derived strictly from the material.\n- Use ## headings and bullet points.`,
    Flashcards: `Create Q&A FLASHCARD pairs from the material below.\n- Generate at least 8 pairs.\n- Format each exactly as:\n**Q:** [Question]\n**A:** [Concise answer drawn directly from the material]`,
  };
  return `${instructions[noteType]}\n\nCRITICAL RULES:\n- Base your notes STRICTLY on the study material provided below.\n- Do NOT add external knowledge, examples, or facts not present in the material.\n- If a detail is not in the material, omit it — never guess.\n- Do NOT output separator lines like ===== or -----.\n\nTOPIC FOCUS: ${topic}\n\nSTUDY MATERIAL:\n───────────────────────────────────────\n${material.slice(0, 28000)}\n───────────────────────────────────────\n\nNow generate the ${noteType} notes in clean Markdown:`;
}

function cleanOutput(raw: string): string {
  return raw
    .replace(/^#+\s*Generated Notes\s*$/gim, "")
    .replace(/^Generated Notes\s*$/gim, "")
    .replace(/^={3,}\s*$/gm, "")
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NotesMaker: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("Summary");
  const [extractedText, setExtractedText] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [extractionInfo, setExtractionInfo] = useState<string>("");

  const handleExtracted = useCallback((text: string, result: ExtractionResult) => {
    setExtractedText(text);
    setError(null);
    const methodMap: Record<string, string> = { text: "text layer", ocr: "OCR", vision: "Vision AI", hybrid: "hybrid extraction", plain: "direct read" };
    setExtractionInfo(`Extracted via ${methodMap[result.method]} · ${text.length.toLocaleString()} characters${result.pageCount ? ` · ${result.pageCount} pages` : ""}`);
    if (result.warning) setError(`⚠️ ${result.warning}`);
  }, []);

  const handleError = useCallback((_msg: string) => {
    // PDFUploader already shows inline error — just clear extracted state
    setExtractedText("");
    setExtractionInfo("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotes("");
    if (!topic.trim()) { setError("Please enter a topic for your notes."); return; }
    if (!extractedText) { setError("Please upload a file first."); return; }
    setIsLoading(true);
    try {
      const prompt = buildPrompt(topic, noteType, extractedText);
      let accumulated = "";
      await callAIStream(
        prompt,
        (chunk) => {
          accumulated += chunk;
          setNotes(cleanOutput(accumulated));
        },
        "You are an expert academic note-taker. Respond in clean Markdown only.",
        0.4,
        3500
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  }, [topic, noteType, extractedText]);

  const handleCopy = useCallback(() => {
    if (!notes) return;
    navigator.clipboard.writeText(notes).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [notes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </header>

      <main className="container mx-auto px-5 py-10 max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">Notes Maker</h1>
            <p className="text-slate-500 text-sm mt-1">Upload your PDF — get structured notes based only on your material.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Configuration */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h2 className="font-bold text-slate-700 text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xs flex items-center justify-center">1</span>
                Configure Notes
              </h2>

              <div>
                <label htmlFor="topic" className="block text-sm font-semibold text-slate-700 mb-1">Topic / Focus area</label>
                <input
                  id="topic" type="text" value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, Newton's Laws, OS Scheduling…"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  disabled={isLoading} required
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Note type</p>
                <div className="space-y-2">
                  {NOTE_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setNoteType(t.value)} disabled={isLoading}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${noteType === t.value ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-300"} disabled:opacity-50`}
                    >
                      <p className="font-bold text-slate-800">{t.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Upload file</p>
                <PDFUploader
                  onExtracted={handleExtracted}
                  onError={handleError}
                  onReset={() => { setExtractedText(""); setExtractionInfo(""); }}
                />
                {extractionInfo && (
                  <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    {extractionInfo}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <span className="shrink-0 mt-0.5">⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={isLoading || !extractedText || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl shadow-md hover:from-amber-600 hover:to-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><BookOpen className="h-4 w-4" />Generate Notes</>}
              </button>
            </div>
          </form>

          {/* Right: Output */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[540px] relative flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-700 dark:text-slate-200 text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xs flex items-center justify-center">2</span>
                  Generated Notes
                </h2>
                <div className="flex items-center gap-2">
                  {notes && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {notes.split(/\s+/).filter(Boolean).length} words · {Math.max(1, Math.ceil(notes.split(/\s+/).filter(Boolean).length / 200))} min read
                    </span>
                  )}
                  {notes && (
                    <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {isLoading && !notes && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                  <p className="text-sm font-medium">Generating notes from your material…</p>
                </div>
              )}

              {notes && (
                <div className="overflow-y-auto flex-1">
                  <MarkdownRenderer content={notes} />
                </div>
              )}

              {!notes && !isLoading && (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm text-center px-6">
                  <p>Your notes will appear here once you upload a file and click <strong>Generate Notes</strong>.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotesMaker;
