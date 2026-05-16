/**
 * MCQPage.tsx — MCQ Generator with robust PDF pipeline
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lightbulb, Trophy, AlertCircle, Loader2 } from "lucide-react";
import { callAIJson } from "@/lib/aiClient";
import { PDFUploader } from "@/components/PDFUploader";

interface MCQ { question: string; options: string[]; correctAnswer: string; }
type ScreenState = "upload" | "count" | "loading" | "quiz" | "results";

function validateMCQs(raw: MCQ[]): MCQ[] {
  return raw.filter((q) =>
    typeof q.question === "string" &&
    Array.isArray(q.options) && q.options.length >= 2 &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.correctAnswer === "string" &&
    q.options.includes(q.correctAnswer)
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
  if (valid.length === 0) throw new Error("The AI could not generate valid questions. Try uploading a richer or clearer document.");
  return valid;
}

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

  useEffect(() => { handleStartOver(); }, []); // eslint-disable-line

  const handlePdfExtracted = (text: string) => {
    setExtractedText(text);
    setPdfInfo(`${text.length.toLocaleString()} chars extracted`);
    setError(null);
    setScreen("count");
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) { setError("Please enter a topic."); return; }
    setError(null); setExtractedText(""); setScreen("count");
  };

  const handleGenerateQuiz = async (e: React.FormEvent, existingQs: MCQ[] = []) => {
    e && e.preventDefault?.();
    if (numQuestions < 1 || numQuestions > 20) { setError("Please enter between 1 and 20 questions."); return; }
    setScreen("loading"); setError(null); setIsGenerating(true);
    try {
      const content = extractedText || topic;
      const existing = existingQs.map((q) => q.question);
      const generated = await generateMCQs(content, numQuestions, existing);
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

  const handleSubmitOrContinue = () => {
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
      } else { setScreen("results"); }
    }
  };

  const handleStartOver = () => {
    setExtractedText(""); setTopic(""); setQuestions([]); setQIndex(0); setScore(0);
    setQuizState("answering"); setSelected(null); setFeedbackStatus(null);
    setError(null); setNumQuestions(5); setIsGenerating(false); setPdfInfo("");
    setScreen("upload");
  };

  const handleGenerateMore = async () => {
    setIsGenerating(true);
    try {
      const content = extractedText || topic;
      const existing = questions.map((q) => q.question);
      const generated = await generateMCQs(content, numQuestions, existing);
      setQuestions(generated); startQuiz();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate more questions.");
    } finally { setIsGenerating(false); }
  };

  const shuffledOptions = useMemo(() => {
    if (!questions[qIndex]?.options) return [];
    return [...questions[qIndex].options].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, qIndex]);

  const buttonText = quizState === "answering" ? "Check" : qIndex < questions.length - 1 ? "Continue" : "Finish Quiz";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-2xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          {screen === "quiz" && questions.length > 0 && (
            <span className="text-sm font-medium text-muted-foreground">{qIndex + 1} / {questions.length}</span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl flex-grow pb-40">

        {screen === "upload" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-center">MCQ Generator</h1>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">📄 Upload PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">Generate questions grounded in your document — no hallucination.</p>
                <PDFUploader
                  onExtracted={handlePdfExtracted}
                  onError={() => {}}
                  onReset={() => { setExtractedText(""); setPdfInfo(""); }}
                />
                {pdfInfo && <p className="text-xs text-green-700 mt-2">✓ {pdfInfo}</p>}
              </CardContent>
            </Card>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-sm font-medium text-muted-foreground uppercase">or</span></div>
            </div>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Lightbulb className="h-5 w-5 text-indigo-500" /> Enter a Topic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">Generate questions about a specific subject area.</p>
                <form onSubmit={handleTopicSubmit} className="flex gap-2">
                  <Input placeholder="e.g. Photosynthesis" value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-grow" required />
                  <Button type="submit" disabled={!topic.trim()}>Use Topic</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {screen === "count" && (
          <Card className="shadow-md">
            <CardHeader><CardTitle>How many questions?</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                {extractedText ? "PDF processed successfully." : `Topic: "${topic}".`} Choose 1–20 questions.
              </p>
              {error && (
                <div className="mb-3 flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <form onSubmit={(e) => handleGenerateQuiz(e)}>
                <Input type="number" min={1} max={20} value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                  className="w-full text-lg mb-4" required />
                <Button type="submit" className="w-full" disabled={isGenerating}>Generate Quiz</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {screen === "loading" && (
          <div className="text-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Generating your quiz…</p>
          </div>
        )}

        {screen === "quiz" && questions.length > 0 && qIndex < questions.length && (
          <>
            <div className="w-full bg-muted rounded-full h-2 mb-8 overflow-hidden">
              <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <p className="text-2xl font-bold text-foreground mb-6">{questions[qIndex].question}</p>
            <div className="space-y-3">
              {shuffledOptions.map((option, i) => {
                const isSelected = selected === option;
                const isCorrect = option === questions[qIndex].correctAnswer;
                let optStyle = "w-full text-left px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ";
                if (quizState === "feedback") {
                  if (isCorrect) optStyle += "border-green-400 bg-green-50 text-green-700";
                  else if (isSelected) optStyle += "border-red-400 bg-red-50 text-red-700";
                  else optStyle += "border-border bg-card opacity-60";
                } else {
                  optStyle += isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50 hover:bg-muted";
                }
                return (
                  <button key={i} onClick={() => quizState === "answering" && setSelected(option)}
                    disabled={quizState === "feedback"} className={optStyle}>
                    {option}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {screen === "results" && (
          <Card className="max-w-md mx-auto shadow-lg">
            <CardHeader className="text-center">
              <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-2" />
              <CardTitle className="text-3xl font-extrabold">Quiz Complete!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {error && <div className="p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm text-left">{error}</div>}
              <p className="text-6xl font-black">{score}<span className="text-2xl font-bold text-muted-foreground">/{questions.length}</span></p>
              <p className="text-muted-foreground font-medium">
                {score / questions.length >= 0.8 ? "Excellent work! 🎉" : score / questions.length >= 0.5 ? "Good job! 👍" : "Keep practising! 💪"}
              </p>
              <Button onClick={handleStartOver} className="w-full mt-4">Try Another Quiz</Button>
              <Button variant="outline" className="w-full" onClick={handleGenerateMore} disabled={isGenerating}>
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</> : "Try New Questions"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {screen === "quiz" && (
        <div className={`sticky bottom-0 border-t z-20 transition-colors ${feedbackStatus === "correct" ? "bg-green-50 border-green-300" : feedbackStatus === "incorrect" ? "bg-red-50 border-red-300" : "bg-card/80 backdrop-blur-sm border-border"}`}>
          <div className="container mx-auto px-4 max-w-2xl py-4">
            {quizState === "feedback" && (
              <div className="mb-3">
                <p className={`text-xl font-bold ${feedbackStatus === "correct" ? "text-green-700" : "text-red-700"}`}>
                  {feedbackStatus === "correct" ? "Correct! ✓" : "Incorrect ✗"}
                </p>
                {feedbackStatus === "incorrect" && (
                  <p className="text-sm text-foreground/80 mt-1">
                    Correct answer: <span className="font-bold text-green-700">{questions[qIndex]?.correctAnswer}</span>
                  </p>
                )}
              </div>
            )}
            <Button onClick={handleSubmitOrContinue} disabled={quizState === "answering" && !selected} className="w-full" size="lg"
              variant={feedbackStatus === "incorrect" ? "destructive" : "default"}>
              {buttonText}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCQPage;
