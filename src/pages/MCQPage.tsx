/**
 * MCQPage.tsx — MCQ Generator with keyboard shortcuts, dark mode, score history
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lightbulb, Trophy, AlertCircle, Loader2, BarChart2, Trash2 } from "lucide-react";
import { callAIJson } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface MCQ { question: string; options: string[]; correctAnswer: string; }
interface ScoreRecord { date: string; score: number; total: number; topic: string; }
type ScreenState = "upload" | "count" | "loading" | "quiz" | "results" | "history";

function validateMCQs(raw: MCQ[]): MCQ[] {
  return raw.filter((q) =>
    typeof q.question === "string" && Array.isArray(q.options) &&
    q.options.length >= 2 && q.options.every((o) => typeof o === "string") &&
    typeof q.correctAnswer === "string" && q.options.includes(q.correctAnswer)
  );
}

const MCQ_SYSTEM = `You are an expert educational assessment creator. Generate MCQs as a valid JSON ARRAY — no markdown, no explanation, just the array. Each item: {"question":"...","options":["A","B","C","D"],"correctAnswer":"exact option string"} Rules: 4 options per question, exactly one correct. correctAnswer must match one of the options exactly. Base questions ONLY on the provided content.`;

async function generateMCQs(content: string, numQuestions: number, existingQuestions: string[] = []): Promise<MCQ[]> {
  const avoidance = existingQuestions.length > 0 ? `\n\nAvoid questions similar to:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";
  const isText = content.length > 50;
  const userPrompt = isText
    ? `Generate exactly ${numQuestions} MCQs based ONLY on the following text. Return a JSON array only.${avoidance}\n\nTEXT:\n${content.slice(0, 28000)}`
    : `Generate exactly ${numQuestions} MCQs on the topic: "${content}". Return a JSON array only.${avoidance}`;
  const raw = await callAIJson<MCQ[] | { questions?: MCQ[] }>(userPrompt, MCQ_SYSTEM);
  const arr = Array.isArray(raw) ? raw : ((raw as { questions?: MCQ[] }).questions ?? []);
  const valid = validateMCQs(arr);
  if (valid.length === 0) throw new Error("The AI could not generate valid questions. Try a richer document.");
  return valid;
}

const HISTORY_KEY = "mcq-score-history";

const MCQPage: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>("upload");
  const [extractedText, setExtractedText] = useState("");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizState, setQuizState] = useState<"answering" | "feedback">("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<"correct" | "incorrect" | null>(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState("");
  const [scoreHistory, setScoreHistory] = useState<ScoreRecord[]>([]);

  useEffect(() => {
    try { setScoreHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch { /* ignore */ }
  }, []);

  // Warn before leaving mid-quiz
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (screen === "quiz") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (screen !== "quiz") return;
    const shuffled = shuffledOptions;
    const handler = (e: KeyboardEvent) => {
      if (quizState === "answering") {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < shuffled.length) setSelected(shuffled[idx]);
        if ((e.key === "Enter" || e.key === " ") && selected) { e.preventDefault(); handleSubmitOrContinue(); }
      } else if (quizState === "feedback") {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); handleSubmitOrContinue(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, quizState, selected, qIndex]);

  const handlePdfExtracted = (text: string) => {
    setExtractedText(text); setPdfInfo(`${text.length.toLocaleString()} chars extracted`);
    setError(null); setScreen("count");
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) { setError("Please enter a topic."); return; }
    setError(null); setExtractedText(""); setScreen("count");
  };

  const handleGenerateQuiz = async (e: React.FormEvent, existingQs: MCQ[] = []) => {
    e?.preventDefault?.();
    if (numQuestions < 1 || numQuestions > 20) { setError("Please enter between 1 and 20 questions."); return; }
    setScreen("loading"); setError(null); setIsGenerating(true);
    try {
      const content = extractedText || topic;
      const generated = await generateMCQs(content, numQuestions, existingQs.map(q => q.question));
      setQuestions(generated); startQuiz();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setScreen(extractedText ? "count" : "upload");
    } finally { setIsGenerating(false); }
  };

  const startQuiz = () => {
    setQIndex(0); setScore(0); setSelected(null);
    setQuizState("answering"); setFeedbackStatus(null); setScreen("quiz");
  };

  const handleSubmitOrContinue = useCallback(() => {
    if (quizState === "answering") {
      if (!selected) return;
      const isCorrect = selected === questions[qIndex].correctAnswer;
      if (isCorrect) setScore((s) => s + 1);
      setFeedbackStatus(isCorrect ? "correct" : "incorrect");
      setQuizState("feedback");
    } else {
      const next = qIndex + 1;
      if (next < questions.length) {
        setQIndex(next); setSelected(null); setQuizState("answering"); setFeedbackStatus(null);
      } else {
        // Save to history
        const finalScore = score + (feedbackStatus === "correct" ? 0 : 0); // already counted
        const record: ScoreRecord = {
          date: new Date().toLocaleDateString(),
          score: feedbackStatus === "correct" ? score + 1 : score,
          total: questions.length,
          topic: topic || "PDF Upload",
        };
        const updated = [record, ...scoreHistory].slice(0, 20);
        setScoreHistory(updated);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        setScreen("results");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState, selected, questions, qIndex, score, feedbackStatus, scoreHistory, topic]);

  const handleStartOver = () => {
    setExtractedText(""); setTopic(""); setQuestions([]); setQIndex(0); setScore(0);
    setQuizState("answering"); setSelected(null); setFeedbackStatus(null);
    setError(null); setNumQuestions(5); setIsGenerating(false); setPdfInfo(""); setScreen("upload");
  };

  const handleGenerateMore = async () => {
    setIsGenerating(true);
    try {
      const content = extractedText || topic;
      const generated = await generateMCQs(content, numQuestions, questions.map(q => q.question));
      setQuestions(generated); startQuiz();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate more questions.");
    } finally { setIsGenerating(false); }
  };

  const clearHistory = () => {
    setScoreHistory([]); localStorage.removeItem(HISTORY_KEY);
  };

  const shuffledOptions = useMemo(() => {
    if (!questions[qIndex]?.options) return [];
    return [...questions[qIndex].options].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, qIndex]);

  const finalScore = screen === "results" ? score : score;
  const pct = questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0;
  const resultEmoji = pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪";
  const resultMsg = pct >= 80 ? "Excellent work!" : pct >= 50 ? "Good job! Keep going." : "Keep practising!";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background dark:from-gray-950 dark:via-gray-900 dark:to-background flex flex-col">
      <header className="border-b dark:border-gray-800 bg-card/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-2xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            {screen === "quiz" && questions.length > 0 && (
              <span className="text-sm font-medium text-muted-foreground">{qIndex + 1} / {questions.length}</span>
            )}
            {scoreHistory.length > 0 && screen !== "quiz" && (
              <Button variant="ghost" size="sm" onClick={() => setScreen("history")} className="text-xs gap-1">
                <BarChart2 className="h-3.5 w-3.5" /> History
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl flex-grow pb-40">

        {/* Upload screen */}
        {screen === "upload" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Lightbulb className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold dark:text-white">MCQ Generator</h1>
              <p className="text-muted-foreground mt-1 text-sm">Keys 1–4 to select · Enter to check · → to continue</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <Card className="shadow-md dark:bg-gray-900 dark:border-gray-700">
              <CardHeader><CardTitle className="text-xl">📄 Upload PDF</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">Generate questions grounded in your document.</p>
                <PDFUploader onExtracted={handlePdfExtracted} onError={() => {}} onReset={() => { setExtractedText(""); setPdfInfo(""); }} />
                {pdfInfo && <p className="text-xs text-green-700 dark:text-green-400 mt-2">✓ {pdfInfo}</p>}
              </CardContent>
            </Card>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t dark:border-gray-700" /></div>
              <div className="relative flex justify-center"><span className="bg-background dark:bg-gray-950 px-3 text-sm font-medium text-muted-foreground uppercase">or</span></div>
            </div>
            <Card className="shadow-md dark:bg-gray-900 dark:border-gray-700">
              <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Lightbulb className="h-5 w-5 text-indigo-500" /> Enter a Topic</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">Generate questions about a specific subject area.</p>
                <form onSubmit={handleTopicSubmit} className="flex gap-2">
                  <Input placeholder="e.g. Photosynthesis" value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-grow dark:bg-gray-800 dark:border-gray-600" required />
                  <Button type="submit" disabled={!topic.trim()}>Use Topic</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Count screen */}
        {screen === "count" && (
          <Card className="shadow-md dark:bg-gray-900 dark:border-gray-700">
            <CardHeader><CardTitle>How many questions?</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                {extractedText ? `📄 PDF ready (${extractedText.length.toLocaleString()} chars).` : `💡 Topic: "${topic}".`} Choose 1–20 questions.
              </p>
              {error && (
                <div className="mb-3 flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <form onSubmit={(e) => handleGenerateQuiz(e)}>
                <div className="flex gap-2 mb-4">
                  {[5, 10, 15, 20].map(n => (
                    <button key={n} type="button" onClick={() => setNumQuestions(n)}
                      className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${numQuestions === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50 dark:border-gray-700 dark:bg-gray-800"}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <Input type="number" min={1} max={20} value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                  className="w-full text-lg mb-4 dark:bg-gray-800 dark:border-gray-600" placeholder="Or enter custom number" />
                <Button type="submit" className="w-full" disabled={isGenerating}>Generate Quiz</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {screen === "loading" && (
          <div className="text-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Generating your quiz…</p>
          </div>
        )}

        {/* Quiz */}
        {screen === "quiz" && questions.length > 0 && qIndex < questions.length && (
          <>
            <div className="w-full bg-muted dark:bg-gray-800 rounded-full h-2 mb-8 overflow-hidden">
              <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-6">{questions[qIndex].question}</p>
            <div className="space-y-3">
              {shuffledOptions.map((option, i) => {
                const isSelected = selected === option;
                const isCorrect = option === questions[qIndex].correctAnswer;
                let optStyle = "w-full text-left px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all flex items-center gap-3 ";
                if (quizState === "feedback") {
                  if (isCorrect) optStyle += "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300";
                  else if (isSelected) optStyle += "border-red-400 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300";
                  else optStyle += "border-border bg-card dark:bg-gray-800 opacity-50";
                } else {
                  optStyle += isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card dark:bg-gray-800 dark:border-gray-700 hover:border-primary/50 hover:bg-muted dark:hover:bg-gray-700";
                }
                return (
                  <button key={i} onClick={() => quizState === "answering" && setSelected(option)}
                    disabled={quizState === "feedback"} className={optStyle}>
                    <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${isSelected && quizState === "answering" ? "border-primary bg-primary text-white" : "border-current opacity-50"}`}>{i + 1}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">Press 1–{shuffledOptions.length} to select · Enter to check</p>
          </>
        )}

        {/* Results */}
        {screen === "results" && (
          <Card className="max-w-md mx-auto shadow-lg dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="text-center">
              <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-2" />
              <CardTitle className="text-3xl font-extrabold">Quiz Complete!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {error && <div className="p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm text-left">{error}</div>}
              <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted dark:text-gray-700" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                    className={pct >= 80 ? "text-green-500" : pct >= 50 ? "text-yellow-500" : "text-red-500"} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-black">{finalScore}</span>
                  <span className="text-xs text-muted-foreground">/{questions.length}</span>
                </div>
              </div>
              <p className="text-lg font-bold">{resultEmoji} {resultMsg}</p>
              <p className="text-muted-foreground text-sm">{pct}% score</p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleStartOver} className="w-full">Try Another Quiz</Button>
                <Button variant="outline" className="w-full dark:border-gray-600" onClick={handleGenerateMore} disabled={isGenerating}>
                  {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</> : "New Questions, Same Topic"}
                </Button>
                {scoreHistory.length > 0 && (
                  <Button variant="ghost" className="w-full text-sm" onClick={() => setScreen("history")}>
                    <BarChart2 className="h-4 w-4 mr-2" /> View Score History
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {screen === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold dark:text-white">Score History</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setScreen("upload")} className="dark:border-gray-600">New Quiz</Button>
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-red-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </div>
            {scoreHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No history yet.</p>
            ) : (
              <div className="space-y-3">
                {scoreHistory.map((record, i) => {
                  const p = Math.round((record.score / record.total) * 100);
                  return (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-sm">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${p >= 80 ? "bg-green-500" : p >= 50 ? "bg-yellow-500" : "bg-red-500"}`}>
                        {p}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate dark:text-white">{record.topic}</p>
                        <p className="text-xs text-muted-foreground">{record.score}/{record.total} correct · {record.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {screen === "quiz" && (
        <div className={`sticky bottom-0 border-t z-20 transition-colors ${
          feedbackStatus === "correct" ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800"
          : feedbackStatus === "incorrect" ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800"
          : "bg-card/80 dark:bg-gray-900/80 backdrop-blur-sm border-border dark:border-gray-700"
        }`}>
          <div className="container mx-auto px-4 max-w-2xl py-4">
            {quizState === "feedback" && (
              <div className="mb-3">
                <p className={`text-xl font-bold ${feedbackStatus === "correct" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {feedbackStatus === "correct" ? "Correct! ✓" : "Incorrect ✗"}
                </p>
                {feedbackStatus === "incorrect" && (
                  <p className="text-sm text-foreground/80 mt-1">
                    Correct answer: <span className="font-bold text-green-700 dark:text-green-400">{questions[qIndex]?.correctAnswer}</span>
                  </p>
                )}
              </div>
            )}
            <Button onClick={handleSubmitOrContinue} disabled={quizState === "answering" && !selected}
              className="w-full" size="lg"
              variant={feedbackStatus === "incorrect" ? "destructive" : "default"}>
              {quizState === "answering" ? "Check" : qIndex < questions.length - 1 ? "Continue →" : "Finish Quiz"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCQPage;
