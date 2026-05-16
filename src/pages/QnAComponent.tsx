/**
 * QnAComponent.tsx — Q&A Assistant with robust PDF pipeline + proper markdown rendering
 */
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquareQuote, Send } from "lucide-react";
import { callAI } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { ExtractionResult } from "@/lib/extractFileText";

type MaterialMode = "text" | "file";
type FormatType = "bullet points" | "detailed explanation" | "short notes" | "summary" | "key points";

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: "bullet points", label: "• Bullet Points" },
  { value: "detailed explanation", label: "📖 Detailed Explanation" },
  { value: "short notes", label: "📋 Short Notes" },
  { value: "summary", label: "📝 Summary" },
  { value: "key points", label: "⭐ Key Points" },
];

const BASE_SYSTEM = `You are an expert academic tutor.\nAnswer the user's question based STRICTLY on the provided study material.\n- Do NOT use external knowledge beyond what is in the material.\n- If the answer cannot be found in the material, respond with: "**Not covered in material:** This information is not present in the provided study material."\n- Avoid filler phrases and repetition.`;

const FORMAT_SYSTEM: Record<FormatType, string> = {
  "bullet points": `${BASE_SYSTEM}\n\nFORMATTING:\n- Start with one bold sentence directly answering the question.\n- Then write EVERY point as a Markdown bullet: "- point"\n- Use nested bullets for sub-details.\n- Aim for 5–10 bullet points.`,
  "detailed explanation": `${BASE_SYSTEM}\n\nFORMATTING:\n- Write in flowing prose paragraphs.\n- Use ## headings to separate major sections.\n- Aim for 3–5 paragraphs.`,
  "short notes": `${BASE_SYSTEM}\n\nFORMATTING:\n- Be extremely concise — max 150 words total.\n- Use short bullet points or numbered list.\n- No long paragraphs.`,
  summary: `${BASE_SYSTEM}\n\nFORMATTING:\n- Write a single cohesive paragraph summary (100–200 words).\n- Start with the most important point.\n- No bullet points or headings.`,
  "key points": `${BASE_SYSTEM}\n\nFORMATTING:\n- List ONLY the most critical points as a numbered list: "1. point"\n- Bold the key term in each point.\n- 5–8 points maximum.`,
};

const QnAComponent: React.FC = () => {
  const navigate = useNavigate();
  const [materialMode, setMaterialMode] = useState<MaterialMode>("text");
  const [materialText, setMaterialText] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [question, setQuestion] = useState("");
  const [format, setFormat] = useState<FormatType>("bullet points");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState("");

  const effectiveMaterial = materialMode === "file" ? extractedText : materialText;

  const handleExtracted = useCallback((text: string, result: ExtractionResult) => {
    setExtractedText(text);
    setError(null);
    const methodMap = { text: "text layer", ocr: "OCR", hybrid: "hybrid", plain: "direct" };
    setPdfInfo(`${methodMap[result.method]} · ${text.length.toLocaleString()} chars${result.pageCount ? ` · ${result.pageCount}p` : ""}`);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAnswer("");
    if (!question.trim()) { setError("Please enter a question."); return; }
    if (!effectiveMaterial.trim()) { setError(materialMode === "file" ? "Please upload a file first." : "Please paste your study material."); return; }
    setIsLoading(true);
    try {
      const userPrompt = `STUDY MATERIAL:\n────────────────────────────────\n${effectiveMaterial.slice(0, 28000)}\n────────────────────────────────\n\nQUESTION: ${question}\n\nAnswer in "${format}" format based ONLY on the study material above:`;
      const raw = await callAI(userPrompt, FORMAT_SYSTEM[format], 0.4, 2500);
      setAnswer(raw.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  }, [question, effectiveMaterial, format, materialMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-5 py-3 flex items-center">
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </header>

      <main className="container mx-auto px-5 py-10 max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center shadow-lg">
            <MessageSquareQuote className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">Q&A Assistant</h1>
            <p className="text-slate-500 text-sm mt-1">Ask any question — answers are drawn strictly from your material.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Input */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Material */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">1. Provide Study Material</h2>

              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                {(["text", "file"] as MaterialMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMaterialMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold transition ${materialMode === m ? "bg-teal-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {m === "text" ? "📋 Paste Text" : "📄 Upload PDF"}
                  </button>
                ))}
              </div>

              {materialMode === "text" ? (
                <textarea
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Paste your study notes, textbook content, lecture slides…"
                  className="w-full min-h-[160px] px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  disabled={isLoading}
                />
              ) : (
                <>
                  <PDFUploader
                    onExtracted={handleExtracted}
                    onError={(msg) => setError(msg)}
                    onReset={() => { setExtractedText(""); setPdfInfo(""); }}
                    compact
                  />
                  {pdfInfo && <p className="text-xs text-green-700">✓ {pdfInfo}</p>}
                </>
              )}
            </div>

            {/* Step 2: Question */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">2. Ask Your Question</h2>
              <input
                type="text" value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is…? How does…? Explain…?"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                disabled={isLoading}
              />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Answer format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as FormatType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                  disabled={isLoading}
                >
                  {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠ {error}</div>
              )}

              <button type="submit" disabled={isLoading || !question.trim() || !effectiveMaterial.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold rounded-xl shadow-md hover:from-teal-600 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Send className="h-4 w-4" />Get Answer</>}
              </button>
            </div>
          </form>

          {/* Right: Answer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[400px] flex flex-col">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4">3. AI Response</h2>

            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                <p className="text-sm">Generating answer…</p>
              </div>
            )}

            {answer && !isLoading && (
              <div className="overflow-y-auto flex-1">
                <MarkdownRenderer content={answer} />
              </div>
            )}

            {!answer && !isLoading && (
              <div className="flex-1 flex items-center justify-center text-slate-300 text-sm text-center px-6">
                Your answer will appear here after you submit a question.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QnAComponent;
