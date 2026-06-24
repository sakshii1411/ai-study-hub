/**
 * QnAComponent.tsx — Q&A Assistant with streaming, multi-turn chat history
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquareQuote, Send, Trash2, Copy, Check } from "lucide-react";
import { callAIStream } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { ExtractionResult } from "@/lib/extractFileText";

type MaterialMode = "text" | "file";
type FormatType = "bullet points" | "detailed explanation" | "short notes" | "summary" | "key points";

interface ChatMessage { role: "user" | "assistant"; text: string; format: FormatType; }

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: "bullet points",        label: "• Bullet Points" },
  { value: "detailed explanation", label: "📖 Detailed Explanation" },
  { value: "short notes",          label: "📋 Short Notes" },
  { value: "summary",              label: "📝 Summary" },
  { value: "key points",           label: "⭐ Key Points" },
];

const BASE_SYSTEM = `You are an expert academic tutor.
Answer the user's question based STRICTLY on the provided study material.
- Do NOT use external knowledge beyond what is in the material.
- If the answer cannot be found in the material, respond with: "**Not covered in material:** This information is not present in the provided study material."
- Avoid filler phrases and repetition.
- You have access to previous questions in the conversation — use them for context.`;

const FORMAT_INSTRUCTIONS: Record<FormatType, string> = {
  "bullet points":        "Format: Start with one bold sentence directly answering the question, then write every point as a Markdown bullet. Aim for 5–10 bullets.",
  "detailed explanation": "Format: Write in flowing prose paragraphs with ## headings for major sections. Aim for 3–5 paragraphs.",
  "short notes":          "Format: Be extremely concise — max 150 words. Use short bullet points or numbered list.",
  summary:                "Format: Write a single cohesive paragraph summary (100–200 words). No bullets or headings.",
  "key points":           "Format: List ONLY the most critical points as a numbered list. Bold the key term in each. 5–8 points maximum.",
};

const QNA_HISTORY_KEY = "qna-chat-history";

const QnAComponent: React.FC = () => {
  const navigate = useNavigate();
  const [materialMode, setMaterialMode] = useState<MaterialMode>("text");
  const [materialText, setMaterialText] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [question, setQuestion] = useState("");
  const [format, setFormat] = useState<FormatType>("bullet points");
  const [history, setHistory] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(QNA_HISTORY_KEY) || "[]"); }
    catch { return []; }
  });
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const effectiveMaterial = materialMode === "file" ? extractedText : materialText;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamingAnswer]);

  // Persist last 20 messages
  useEffect(() => {
    try { localStorage.setItem(QNA_HISTORY_KEY, JSON.stringify(history.slice(-20))); }
    catch { /* storage full */ }
  }, [history]);

  const handleExtracted = useCallback((text: string, result: ExtractionResult) => {
    setExtractedText(text);
    setError(null);
    const methodMap: Record<string, string> = { text: "text layer", ocr: "OCR", hybrid: "hybrid", plain: "direct" };
    setPdfInfo(`${methodMap[result.method] ?? result.method} · ${text.length.toLocaleString()} chars${result.pageCount ? ` · ${result.pageCount}p` : ""}`);
  }, []);

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!question.trim()) { setError("Please enter a question."); return; }
    if (!effectiveMaterial.trim()) { setError(materialMode === "file" ? "Please upload a file first." : "Please paste your study material."); return; }

    const userMsg: ChatMessage = { role: "user", text: question.trim(), format };
    setHistory(prev => [...prev, userMsg]);
    setQuestion("");
    setIsLoading(true);
    setStreamingAnswer("");

    try {
      // Build conversation context from history (last 6 messages)
      const historyContext = history.slice(-6).map(m =>
        `${m.role === "user" ? "Student" : "Tutor"}: ${m.text}`
      ).join("\n");

      const userPrompt = `STUDY MATERIAL:\n${"─".repeat(40)}\n${effectiveMaterial.slice(0, 28000)}\n${"─".repeat(40)}\n\n${historyContext ? `PREVIOUS CONVERSATION:\n${historyContext}\n\n` : ""}CURRENT QUESTION: ${userMsg.text}\n\n${FORMAT_INSTRUCTIONS[format]}\n\nAnswer based ONLY on the study material above:`;

      let accumulated = "";
      await callAIStream(
        userPrompt,
        (chunk) => { accumulated += chunk; setStreamingAnswer(accumulated); },
        BASE_SYSTEM,
        0.4,
        2500
      );

      setHistory(prev => [...prev, { role: "assistant", text: accumulated.trim(), format }]);
      setStreamingAnswer("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setHistory(prev => prev.slice(0, -1)); // remove the user message on error
    } finally {
      setIsLoading(false);
    }
  }, [question, effectiveMaterial, format, materialMode, history]);

  const clearHistory = () => { setHistory([]); setStreamingAnswer(""); setError(null); localStorage.removeItem(QNA_HISTORY_KEY); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-teal-950/20">
      <header className="border-b border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          {history.length > 0 && (
            <button onClick={clearHistory} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 transition px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
              <Trash2 className="h-3.5 w-3.5" /> Clear chat
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-5 py-10 max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center shadow-lg">
            <MessageSquareQuote className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">Q&A Assistant</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ask questions — answers streamed strictly from your material. Multi-turn conversation supported.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Left: Material + question form — 2 cols */}
          <form onSubmit={handleSubmit} className="md:col-span-2 space-y-5">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">1. Study Material</h2>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700">
                {(["text", "file"] as MaterialMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMaterialMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold transition ${materialMode === m ? "bg-teal-500 text-white" : "bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700"}`}>
                    {m === "text" ? "📋 Paste Text" : "📄 Upload PDF"}
                  </button>
                ))}
              </div>
              {materialMode === "text" ? (
                <textarea value={materialText} onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Paste your study notes, textbook content, lecture slides…"
                  className="w-full min-h-[140px] px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100"
                  disabled={isLoading} />
              ) : (
                <>
                  <PDFUploader onExtracted={handleExtracted} onError={(msg) => setError(msg)} onReset={() => { setExtractedText(""); setPdfInfo(""); }} compact />
                  {pdfInfo && <p className="text-xs text-green-700 dark:text-green-400">✓ {pdfInfo}</p>}
                </>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">2. Ask a Question</h2>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is…? How does…? Explain…?"
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100"
                disabled={isLoading}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
              />
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Answer format</label>
                <select value={format} onChange={(e) => setFormat(e.target.value as FormatType)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100"
                  disabled={isLoading}>
                  {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {error && <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">⚠ {error}</div>}
              <button type="submit" disabled={isLoading || !question.trim() || !effectiveMaterial.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold rounded-xl shadow-md hover:from-teal-600 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Send className="h-4 w-4" />Ask</>}
              </button>
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">Enter or click Ask · Shift+Enter for new line</p>
            </div>
          </form>

          {/* Right: Chat history — 3 cols */}
          <div className="md:col-span-3">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 min-h-[500px] flex flex-col">
              <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider mb-4">3. Conversation</h2>

              {history.length === 0 && !streamingAnswer && !isLoading && (
                <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm text-center px-6">
                  Your answers will appear here. You can ask follow-up questions and build a conversation.
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-5 max-h-[600px] pr-1">
                {history.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {msg.role === "user" ? (
                      <div className="bg-teal-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-sm font-medium">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl rounded-tl-sm p-4 text-sm">
                          <MarkdownRenderer content={msg.text} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-2">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{msg.format}</span>
                          <button onClick={() => handleCopy(msg.text, i)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-teal-600 transition">
                            {copiedIdx === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            {copiedIdx === i ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming answer */}
                {streamingAnswer && (
                  <div className="items-start flex flex-col gap-1">
                    <div className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl rounded-tl-sm p-4 text-sm">
                      <MarkdownRenderer content={streamingAnswer} />
                      <span className="inline-block w-2 h-4 bg-teal-400 animate-pulse ml-0.5 rounded-sm" />
                    </div>
                  </div>
                )}

                {isLoading && !streamingAnswer && (
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-400" /> Generating answer…
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default QnAComponent;
