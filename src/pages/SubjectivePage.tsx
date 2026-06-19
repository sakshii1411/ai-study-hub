import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { X, FileText, RefreshCw, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { callAI } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";
import jsPDF from "jspdf";

interface GeneratedQuestion { question: string; marks: number; type?: string; }
interface EvaluationResult { question: string; answer: string; feedback: string; rating: number; modelAnswer: string; }

const DuoButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "green"|"blue"|"red"|"gray"; icon?: React.ElementType;
}> = ({ className, variant="blue", children, icon: Icon, ...props }) => {
  const v = {
    green: "bg-[#58cc02] border-[#58a700] text-white dark:bg-green-600 dark:border-green-700",
    blue:  "bg-[#1cb0f6] border-[#1899d6] text-white dark:bg-blue-600 dark:border-blue-700",
    red:   "bg-[#ff4b4b] border-[#ea2b2b] text-white dark:bg-red-600 dark:border-red-700",
    gray:  "bg-[#e5e5e5] border-[#b2b2b2] text-[#777777] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200",
  }[variant];
  return (
    <button className={cn("w-full flex items-center justify-center gap-2 rounded-2xl font-extrabold uppercase py-3 px-4 border-b-[5px] transition-all active:translate-y-[2px] active:border-b-[3px] disabled:opacity-50 disabled:cursor-not-allowed", v, className)} {...props}>
      {Icon && <Icon className="h-5 w-5" />}
      <span>{children}</span>
    </button>
  );
};

const SubjectivePage: React.FC = () => {
  const navigate = useNavigate();
  const [marks, setMarks] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("Loading…");
  const [section, setSection] = useState<"upload"|"test"|"results">("upload");
  const [material, setMaterial] = useState("");
  const [pdfExtracted, setPdfExtracted] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showError, setShowError] = useState(false);
  const [inputMode, setInputMode] = useState<"pdf"|"text">("pdf");
  const [expandedModel, setExpandedModel] = useState<number | null>(null);

  const showLoader = (t: string) => { setLoaderText(t); setIsLoading(true); };
  const hideLoader = () => setIsLoading(false);
  const showErr = (m: string) => { setErrorMsg(m); setShowError(true); toast.error(m); };
  const goTo = (s: "upload"|"test"|"results") => { setSection(s); window.scrollTo(0,0); };

  const ratingStyle = (r: number) =>
    r>=8 ? {bg:"bg-green-100 dark:bg-green-950",border:"border-green-400 dark:border-green-700",text:"text-green-700 dark:text-green-400",icon:CheckCircle}
    : r>=5 ? {bg:"bg-yellow-100 dark:bg-yellow-950",border:"border-yellow-400 dark:border-yellow-700",text:"text-yellow-700 dark:text-yellow-400",icon:AlertTriangle}
    : {bg:"bg-red-100 dark:bg-red-950",border:"border-red-300 dark:border-red-700",text:"text-red-700 dark:text-red-400",icon:AlertTriangle};

  async function generateQuestions(isMore=false) {
    const mat = pdfExtracted || material;
    if (!mat.trim()) { showErr("Please provide study material."); return; }
    if (mat.length < 50) { showErr("Material is too short. Please provide more content."); return; }
    if (!isMore) setHistory([]);

    showLoader(isMore?"Generating new questions…":"Generating questions…");
    const avoidance = history.length ? `\nAvoid these questions:\n${history.map((q,i)=>`${i+1}. ${q}`).join("\n")}` : "";

    try {
      const prompt = `Generate exactly 5 subjective exam questions based ONLY on the study material below.\nEach question should require critical thinking and suit a ${marks}-mark answer.\nReturn valid JSON only: {"questions":[{"question":"...","marks":${marks},"type":"faq|equation|concept"}]}\nNo text outside the JSON.${avoidance}\n\nSTUDY MATERIAL:\n────────────────────────────────────────\n${mat.slice(0,28000)}\n────────────────────────────────────────`;
      const raw = await callAI(prompt, "You are an expert educator. Return ONLY valid JSON. No markdown, no text outside JSON.", 0.5, 1500);
      const clean = raw.replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}")+1));
      if (!parsed.questions?.length) throw new Error("No questions in AI response.");
      const qs: GeneratedQuestion[] = parsed.questions.slice(0,5).map((q: {question:string;marks?:number;type?:string}) => ({
        question: q.question, marks: q.marks ?? marks, type: q.type,
      }));
      setHistory(prev => [...prev, ...qs.map(q=>q.question)]);
      setQuestions(qs); setAnswers(new Array(qs.length).fill("")); setQIndex(0); goTo("test");
    } catch(e:unknown) {
      showErr(`Failed to generate questions: ${(e instanceof Error)?e.message:"Unknown error"}`);
    } finally { hideLoader(); }
  }

  async function submitAnswers() {
    showLoader("Evaluating answers…");
    const mat = pdfExtracted || material;
    const payload = questions.map((q,i)=>({ question:q.question, marks:q.marks, answer:answers[i]||"" }));
    try {
      // Ask AI to also return a model answer for each question
      const prompt = `Evaluate the student's answers based ONLY on the study material below.\nFor each answer provide: feedback (2-3 sentences), rating (1-10), and a concise model answer (3-5 sentences showing what an ideal answer looks like).\nReturn JSON: {"evaluation":[{"question":"...","answer":"...","feedback":"...","rating":7,"modelAnswer":"..."}]}\n\nSTUDY MATERIAL:\n────────────────────────────────────────\n${mat.slice(0,20000)}\n────────────────────────────────────────\n\nQUESTIONS AND ANSWERS:\n${JSON.stringify(payload)}`;
      const raw = await callAI(prompt, "You are an expert educator. Evaluate strictly based on the provided material. Return ONLY valid JSON.", 0.4, 3000);
      const clean = raw.replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}")+1));
      if (!parsed.evaluation?.length) throw new Error("Invalid evaluation format.");
      setResults(parsed.evaluation);
      setExpandedModel(null);
      goTo("results");
    } catch(e:unknown) {
      showErr(`Evaluation failed: ${(e instanceof Error)?e.message:"Unknown error"}`);
    } finally { hideLoader(); }
  }

  const handleNext = () => {
    if (!answers[qIndex]?.trim()) { showErr("Please answer this question before continuing."); return; }
    if (qIndex < questions.length-1) setQIndex(q=>q+1);
    else submitAnswers();
  };

  const startOver = () => {
    setMaterial(""); setPdfExtracted(""); setQuestions([]); setAnswers([]); setResults([]);
    setHistory([]); setQIndex(0); goTo("upload");
  };

  const exportPDF = () => {
    if (!results.length) return;
    try {
      const doc = new jsPDF();
      const margin = 15;
      const pageW = doc.internal.pageSize.getWidth() - margin * 2;
      const pageH = doc.internal.pageSize.getHeight();
      let y = margin;

      const addText = (text: string, fontSize: number, color: [number,number,number] = [50,50,50], bold = false) => {
        doc.setFontSize(fontSize).setTextColor(...color);
        if (bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, pageW);
        if (y + lines.length * (fontSize * 0.5) > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(lines, margin, y);
        y += lines.length * (fontSize * 0.5) + 3;
      };

      addText("Subjective Practice — Evaluation Report", 16, [30,30,30], true);
      y += 4;

      results.forEach((item, i) => {
        if (y > pageH - 60) { doc.addPage(); y = margin; }
        addText(`Q${i+1}: ${item.question}`, 11, [40,40,40], true);
        addText(`Your Answer: ${item.answer || "(No answer)"}`, 10, [80,80,80]);
        addText(`Rating: ${item.rating}/10`, 10, item.rating >= 8 ? [22,163,74] : item.rating >= 5 ? [202,138,4] : [220,38,38], true);
        addText(`Feedback: ${item.feedback}`, 10, [60,60,60]);
        if (item.modelAnswer) addText(`Model Answer: ${item.modelAnswer}`, 10, [30,100,60]);
        y += 4;
      });

      doc.save("subjective-evaluation.pdf");
      toast.success("Exported to PDF!");
    } catch { toast.error("Export failed."); }
  };

  const progress = questions.length ? ((qIndex+1)/questions.length)*100 : 0;
  const currentQ = questions[qIndex];
  const hasMaterial = !!(pdfExtracted || material.trim());
  const avgRating = results.length ? Math.round(results.reduce((s,r)=>s+r.rating,0)/results.length*10)/10 : 0;

  return (
    <div className="min-h-screen bg-[#f7f7f7] dark:bg-gray-950 text-[#4b4b4b] dark:text-gray-100">
      <header className="border-b border-[#e5e5e5] dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Button variant="ghost" onClick={()=>navigate("/dashboard")} className="text-[#afafaf] dark:text-gray-400 hover:text-[#4b4b4b] dark:hover:text-white">
            <X className="h-5 w-5" />
          </Button>
          <div className={`flex-grow mx-4 max-w-md transition-opacity ${section==="test"?"opacity-100":"opacity-0"}`}>
            {section==="test" && (
              <>
                <Progress value={progress} className="h-3 bg-[#e5e5e5] dark:bg-gray-700 [&>div]:bg-[#58cc02]" />
                <p className="text-xs text-center text-[#afafaf] dark:text-gray-500 mt-1 font-bold">{qIndex+1}/{questions.length}</p>
              </>
            )}
          </div>
          {section==="results" && (
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 text-xs dark:border-gray-600 dark:text-gray-300">
              <Download className="h-3.5 w-3.5" /> Export PDF
            </Button>
          )}
          {section!=="results" && <div className="w-10" />}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Upload */}
        {section==="upload" && (
          <Card className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-[#e5e5e5] dark:border-gray-700 shadow-lg">
            <CardHeader className="p-0 mb-6 text-center">
              <FileText className="h-14 w-14 text-orange-500 mx-auto mb-3" />
              <h2 className="text-3xl font-extrabold text-[#4b4b4b] dark:text-white">Subjective Practice</h2>
              <p className="text-[#777] dark:text-gray-400 text-sm mt-1">Upload PDF or paste notes — get AI-evaluated exam questions with model answers.</p>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-[#e5e5e5] dark:border-gray-700">
                {(["pdf","text"] as const).map((m) => (
                  <button key={m} onClick={() => setInputMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold transition ${inputMode===m?"bg-[#1cb0f6] dark:bg-blue-600 text-white":"bg-white dark:bg-gray-800 text-[#777] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                    {m==="pdf"?"📄 Upload PDF":"📋 Paste Text"}
                  </button>
                ))}
              </div>
              {inputMode==="pdf" ? (
                <PDFUploader
                  onExtracted={(text) => { setPdfExtracted(text); setMaterial(""); toast.success("PDF extracted!"); }}
                  onError={(msg) => setErrorMsg(msg)}
                  onReset={() => setPdfExtracted("")}
                />
              ) : (
                <Textarea value={material} onChange={e=>{setMaterial(e.target.value); setPdfExtracted("");}}
                  className="w-full h-36 border-2 border-[#d3d3d3] dark:border-gray-600 dark:bg-gray-800 rounded-xl"
                  placeholder="Paste study material here…" />
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-[#4b4b4b] dark:text-gray-200 whitespace-nowrap">Marks per Q:</label>
                <input type="number" min={1} max={20} value={marks} onChange={e=>setMarks(Number(e.target.value))}
                  className="w-20 border-2 border-[#d3d3d3] dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm" />
              </div>
              <DuoButton variant="blue" onClick={()=>generateQuestions(false)} disabled={isLoading || !hasMaterial}>
                Generate Key Questions
              </DuoButton>
            </CardContent>
          </Card>
        )}

        {/* Test */}
        {section==="test" && currentQ && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-[#e5e5e5] dark:border-gray-700 shadow-lg">
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-[#afafaf] dark:text-gray-500 uppercase tracking-wide">Question {qIndex+1}</h3>
                <span className="text-xs font-bold text-[#afafaf] dark:text-gray-400 bg-[#e5e5e5] dark:bg-gray-700 px-3 py-1 rounded-lg">{currentQ.marks} Marks</span>
              </div>
              <p className="text-lg font-semibold text-[#4b4b4b] dark:text-white leading-relaxed">{currentQ.question}</p>
              {currentQ.type && <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full mt-2 inline-block">{currentQ.type}</span>}
            </div>
            <Textarea value={answers[qIndex]||""} onChange={e=>{const a=[...answers];a[qIndex]=e.target.value;setAnswers(a);}}
              className="w-full h-48 border-2 border-[#d3d3d3] dark:border-gray-600 dark:bg-gray-800 rounded-xl focus:ring-[#58cc02] focus:border-[#58cc02] mb-5 bg-gray-50 dark:text-white"
              placeholder="Type your detailed answer here…" />
            <div className="flex gap-3">
              {qIndex > 0 && (
                <button onClick={() => setQIndex(q=>q-1)}
                  className="px-4 py-3 rounded-2xl border-2 border-b-[5px] border-[#e5e5e5] dark:border-gray-600 bg-white dark:bg-gray-800 text-[#777] dark:text-gray-300 font-bold text-sm">
                  ← Back
                </button>
              )}
              <DuoButton variant="green" onClick={handleNext} disabled={isLoading||!answers[qIndex]?.trim()} className="flex-1">
                {qIndex===questions.length-1?"Check Answers":"Continue"}
              </DuoButton>
            </div>
          </div>
        )}

        {/* Results */}
        {section==="results" && (
          <Card className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-[#e5e5e5] dark:border-gray-700 shadow-lg">
            <div className="text-center mb-6">
              <CheckCircle className="h-14 w-14 text-[#58cc02] mx-auto mb-3" />
              <h2 className="text-3xl font-extrabold text-[#4b4b4b] dark:text-white">Evaluation Complete!</h2>
              <p className="text-[#777] dark:text-gray-400 text-sm mt-1">
                Average rating: <span className={`font-bold ${avgRating>=8?"text-green-600":avgRating>=5?"text-yellow-600":"text-red-600"}`}>{avgRating}/10</span>
              </p>
            </div>
            <div className="space-y-5 mb-8">
              {results.map((item,i)=>{ const s=ratingStyle(item.rating); const Icon=s.icon; return (
                <div key={i} className={cn("p-4 rounded-xl border-2",s.border,s.bg)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="font-bold text-[#4b4b4b] dark:text-white text-sm flex-grow">Q{i+1}: <span className="font-normal text-[#777] dark:text-gray-300">{item.question}</span></p>
                    <div className={cn("flex-shrink-0 text-center w-16 px-2 py-1 rounded-lg border",s.border,s.bg)}>
                      <Icon className={cn("h-4 w-4 mx-auto mb-0.5",s.text)} />
                      <span className={cn("text-lg font-extrabold",s.text)}>{item.rating}<span className="text-xs">/10</span></span>
                    </div>
                  </div>

                  {/* Your answer */}
                  <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg border border-[#e5e5e5] dark:border-gray-600 mb-2">
                    <p className="text-xs font-bold text-[#4b4b4b] dark:text-gray-300 uppercase tracking-wider mb-1">Your Answer:</p>
                    <p className="text-[#777] dark:text-gray-400 text-sm whitespace-pre-wrap">{item.answer||<em>No answer.</em>}</p>
                  </div>

                  {/* AI Feedback */}
                  <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 p-3 rounded-lg mb-2">
                    <p className="text-xs font-bold text-green-800 dark:text-green-400 uppercase tracking-wider mb-1">AI Feedback:</p>
                    <p className="text-green-900 dark:text-green-300 text-sm">{item.feedback}</p>
                  </div>

                  {/* Model Answer — collapsible */}
                  {item.modelAnswer && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedModel(expandedModel === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-left">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider">💡 Model Answer</span>
                        {expandedModel === i
                          ? <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          : <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      </button>
                      {expandedModel === i && (
                        <div className="px-3 py-3 bg-blue-50/50 dark:bg-blue-950/30">
                          <p className="text-blue-900 dark:text-blue-200 text-sm leading-relaxed">{item.modelAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );})}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <DuoButton variant="blue" onClick={()=>generateQuestions(true)} disabled={isLoading} icon={RefreshCw}>More Questions</DuoButton>
              <DuoButton variant="gray" onClick={startOver} disabled={isLoading}>New Material</DuoButton>
            </div>
          </Card>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-14 h-14 text-[#58cc02] animate-spin" />
            <p className="text-[#777] dark:text-gray-300 text-lg font-bold mt-4 animate-pulse">{loaderText}</p>
          </div>
        )}
        {showError && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border dark:border-gray-700">
              <AlertTriangle className="h-12 w-12 text-[#ff4b4b] mx-auto mb-3" />
              <h3 className="text-xl font-extrabold text-[#ea2b2b] mb-3">Something went wrong</h3>
              <p className="text-[#777] dark:text-gray-400 mb-6 text-sm">{errorMsg}</p>
              <DuoButton variant="red" onClick={()=>setShowError(false)}>Got it</DuoButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SubjectivePage;
