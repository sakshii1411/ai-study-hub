import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { X, FileText, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { callAI } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface GeneratedQuestion { question: string; marks: number; type?: string; }
interface EvaluationResult { question: string; answer: string; feedback: string; rating: number; }

const DuoButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "green"|"blue"|"red"|"gray"; icon?: React.ElementType;
}> = ({ className, variant="blue", children, icon: Icon, ...props }) => {
  const v = {
    green:"bg-[#58cc02] border-[#58a700] text-white",
    blue:"bg-[#1cb0f6] border-[#1899d6] text-white",
    red:"bg-[#ff4b4b] border-[#ea2b2b] text-white",
    gray:"bg-[#e5e5e5] border-[#b2b2b2] text-[#777777]",
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

  const showLoader = (t: string) => { setLoaderText(t); setIsLoading(true); };
  const hideLoader = () => setIsLoading(false);
  const showErr = (m: string) => { setErrorMsg(m); setShowError(true); toast.error(m); };
  const goTo = (s: "upload"|"test"|"results") => { setSection(s); window.scrollTo(0,0); };

  const ratingStyle = (r: number) =>
    r>=8 ? {bg:"bg-green-100",border:"border-green-400",text:"text-green-700",icon:CheckCircle}
    : r>=5 ? {bg:"bg-yellow-100",border:"border-yellow-400",text:"text-yellow-700",icon:AlertTriangle}
    : {bg:"bg-red-100",border:"border-red-300",text:"text-red-700",icon:AlertTriangle};

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
      const prompt = `Evaluate the student's answers based ONLY on the study material below.\nFor each answer provide: feedback (2-3 sentences), rating (1-10).\nReturn JSON: {"evaluation":[{"question":"...","answer":"...","feedback":"...","rating":7}]}\n\nSTUDY MATERIAL:\n────────────────────────────────────────\n${mat.slice(0,20000)}\n────────────────────────────────────────\n\nQUESTIONS AND ANSWERS:\n${JSON.stringify(payload)}`;
      const raw = await callAI(prompt, "You are an expert educator. Evaluate strictly based on the provided material. Return ONLY valid JSON.", 0.4, 2500);
      const clean = raw.replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}")+1));
      if (!parsed.evaluation?.length) throw new Error("Invalid evaluation format.");
      setResults(parsed.evaluation); goTo("results");
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

  const progress = questions.length ? ((qIndex+1)/questions.length)*100 : 0;
  const currentQ = questions[qIndex];
  const hasMaterial = !!(pdfExtracted || material.trim());

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#4b4b4b]">
      <header className="border-b border-[#e5e5e5] bg-white sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Button variant="ghost" onClick={()=>navigate("/dashboard")} className="text-[#afafaf] hover:text-[#4b4b4b]">
            <X className="h-5 w-5" />
          </Button>
          <div className={`flex-grow mx-4 max-w-md transition-opacity ${section==="test"?"opacity-100":"opacity-0"}`}>
            {section==="test" && (
              <>
                <Progress value={progress} className="h-3 bg-[#e5e5e5] [&>div]:bg-[#58cc02]" />
                <p className="text-xs text-center text-[#afafaf] mt-1 font-bold">{qIndex+1}/{questions.length}</p>
              </>
            )}
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {section==="upload" && (
          <Card className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-lg">
            <CardHeader className="p-0 mb-6 text-center">
              <FileText className="h-14 w-14 text-orange-500 mx-auto mb-3" />
              <h2 className="text-3xl font-extrabold text-[#4b4b4b]">Subjective Practice</h2>
              <p className="text-[#777] text-sm mt-1">Upload PDF or paste notes — get AI-evaluated exam questions.</p>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {/* Mode tabs */}
              <div className="flex rounded-xl overflow-hidden border border-[#e5e5e5]">
                {(["pdf", "text"] as const).map((m) => (
                  <button key={m} onClick={() => setInputMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold transition ${inputMode === m ? "bg-[#1cb0f6] text-white" : "bg-white text-[#777] hover:bg-gray-50"}`}>
                    {m === "pdf" ? "📄 Upload PDF" : "📋 Paste Text"}
                  </button>
                ))}
              </div>

              {inputMode === "pdf" ? (
                <PDFUploader
                  onExtracted={(text) => { setPdfExtracted(text); setMaterial(""); toast.success("PDF extracted successfully!"); }}
                  onError={(msg) => { setErrorMsg(msg); }}
                  onReset={() => setPdfExtracted("")}
                />
              ) : (
                <Textarea value={material} onChange={e=>{setMaterial(e.target.value); setPdfExtracted("");}}
                  className="w-full h-36 border-2 border-[#d3d3d3] rounded-xl focus:ring-[#58cc02] focus:border-[#58cc02]"
                  placeholder="Paste study material here…" />
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-[#4b4b4b] whitespace-nowrap">Marks per Q:</label>
                <input type="number" min={1} max={20} value={marks} onChange={e=>setMarks(Number(e.target.value))}
                  className="w-20 border-2 border-[#d3d3d3] rounded-xl px-3 py-2 text-sm focus:ring-[#58cc02]" />
              </div>

              <DuoButton variant="blue" onClick={()=>generateQuestions(false)} disabled={isLoading || !hasMaterial}>
                Generate Key Questions
              </DuoButton>
            </CardContent>
          </Card>
        )}

        {section==="test" && currentQ && (
          <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-lg">
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-[#afafaf] uppercase tracking-wide">Question {qIndex+1}</h3>
                <span className="text-xs font-bold text-[#afafaf] bg-[#e5e5e5] px-3 py-1 rounded-lg">{currentQ.marks} Marks</span>
              </div>
              <p className="text-lg font-semibold text-[#4b4b4b] leading-relaxed">{currentQ.question}</p>
              {currentQ.type && <span className="text-xs font-semibold uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-2 inline-block">{currentQ.type}</span>}
            </div>
            <Textarea value={answers[qIndex]||""} onChange={e=>{const a=[...answers];a[qIndex]=e.target.value;setAnswers(a);}}
              className="w-full h-48 border-2 border-[#d3d3d3] rounded-xl focus:ring-[#58cc02] focus:border-[#58cc02] mb-5 bg-gray-50"
              placeholder="Type your detailed answer here…" />
            <DuoButton variant="green" onClick={handleNext} disabled={isLoading||!answers[qIndex]?.trim()}>
              {qIndex===questions.length-1?"Check Answers":"Continue"}
            </DuoButton>
          </div>
        )}

        {section==="results" && (
          <Card className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-lg">
            <div className="text-center mb-6">
              <CheckCircle className="h-14 w-14 text-[#58cc02] mx-auto mb-3" />
              <h2 className="text-3xl font-extrabold text-[#4b4b4b]">Evaluation Complete!</h2>
            </div>
            <div className="space-y-5 mb-8">
              {results.map((item,i)=>{ const s=ratingStyle(item.rating); const Icon=s.icon; return (
                <div key={i} className={cn("p-4 rounded-xl border-2",s.border,s.bg)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="font-bold text-[#4b4b4b] text-sm flex-grow">Q{i+1}: <span className="font-normal text-[#777]">{item.question}</span></p>
                    <div className={cn("flex-shrink-0 text-center w-16 px-2 py-1 rounded-lg border",s.border,s.bg)}>
                      <Icon className={cn("h-4 w-4 mx-auto mb-0.5",s.text)} />
                      <span className={cn("text-lg font-extrabold",s.text)}>{item.rating}<span className="text-xs">/10</span></span>
                    </div>
                  </div>
                  <div className="bg-white/60 p-3 rounded-lg border border-[#e5e5e5] mb-2">
                    <p className="text-xs font-bold text-[#4b4b4b] uppercase tracking-wider mb-1">Your Answer:</p>
                    <p className="text-[#777] text-sm whitespace-pre-wrap">{item.answer||<em>No answer.</em>}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <p className="text-xs font-bold text-green-800 uppercase tracking-wider mb-1">AI Feedback:</p>
                    <p className="text-green-900 text-sm">{item.feedback}</p>
                  </div>
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
          <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-14 h-14 text-[#58cc02] animate-spin" />
            <p className="text-[#777] text-lg font-bold mt-4 animate-pulse">{loaderText}</p>
          </div>
        )}
        {showError && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
              <AlertTriangle className="h-12 w-12 text-[#ff4b4b] mx-auto mb-3" />
              <h3 className="text-xl font-extrabold text-[#ea2b2b] mb-3">Something went wrong</h3>
              <p className="text-[#777] mb-6 text-sm">{errorMsg}</p>
              <DuoButton variant="red" onClick={()=>setShowError(false)}>Got it</DuoButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SubjectivePage;
