import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Brain,
  FileText,
  ImageIcon,
  Lightbulb,
  MessageSquare,
  MessageSquareQuote,
  Target,
  Sparkles,
  Moon,
  Sun,
  Timer,
  Pause,
  Play,
  RotateCcw,
  CalendarDays,
} from "lucide-react";

const aiTools = [
  { title: "Notes Maker", description: "Generate structured study notes from your PDF or text.", path: "/notes-maker", icon: FileText, gradient: "from-blue-500 to-blue-600", glow: "hover:shadow-blue-200 dark:hover:shadow-blue-900" },
  { title: "Q&A Assistant", description: "Ask questions and get grounded answers from your material.", path: "/qna-component", icon: MessageSquareQuote, gradient: "from-emerald-500 to-green-600", glow: "hover:shadow-emerald-200 dark:hover:shadow-emerald-900" },
  { title: "Theory Memorizer", description: "Generate mnemonics and mind maps to lock in key concepts.", path: "/theory-memorizer", icon: Brain, gradient: "from-violet-500 to-purple-600", glow: "hover:shadow-violet-200 dark:hover:shadow-violet-900" },
  { title: "Flashcards", description: "Study with AI-generated flashcards + spaced repetition.", path: "/flashcard", icon: BookOpen, gradient: "from-orange-500 to-orange-600", glow: "hover:shadow-orange-200 dark:hover:shadow-orange-900" },
  { title: "MCQ Generator", description: "Test yourself with multiple-choice questions from your PDF.", path: "/mcq", icon: Target, gradient: "from-red-500 to-rose-600", glow: "hover:shadow-red-200 dark:hover:shadow-red-900" },
  { title: "Subjective Practice", description: "Practice long-form answers with AI evaluation and feedback.", path: "/subjective", icon: Lightbulb, gradient: "from-amber-500 to-yellow-600", glow: "hover:shadow-amber-200 dark:hover:shadow-amber-900" },
  { title: "Theory to Visual", description: "Visualise complex theories as AI-generated diagrams.", path: "/image-generator", icon: ImageIcon, gradient: "from-pink-500 to-fuchsia-600", glow: "hover:shadow-pink-200 dark:hover:shadow-pink-900" },
  { title: "AI Tutor", description: "Speak with a personal AI tutor in real time.", path: "/ai-tutor", icon: MessageSquare, gradient: "from-teal-500 to-cyan-600", glow: "hover:shadow-teal-200 dark:hover:shadow-teal-900" },
  { title: "Study Planner", description: "Create AI-generated study plans with daily schedules.", path: "/create-plan", icon: CalendarDays, gradient: "from-indigo-500 to-blue-600", glow: "hover:shadow-indigo-200 dark:hover:shadow-indigo-900" },
];

const POMODORO_PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
];

function Pomodoro() {
  const [preset, setPreset] = useState(0);
  const [remaining, setRemaining] = useState(POMODORO_PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const selectPreset = (i: number) => {
    setPreset(i); setRemaining(POMODORO_PRESETS[i].seconds); setRunning(false);
  };
  const reset = () => { setRemaining(POMODORO_PRESETS[preset].seconds); setRunning(false); };
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = (remaining / POMODORO_PRESETS[preset].seconds) * 100;

  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="h-4 w-4 text-indigo-500" />
        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Pomodoro Timer</span>
      </div>
      <div className="flex gap-1 mb-4">
        {POMODORO_PRESETS.map((p, i) => (
          <button key={i} onClick={() => selectPreset(i)}
            className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all ${preset === i ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {/* Ring */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-gray-700" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="text-indigo-500 transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{mm}:{ss}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setRunning(r => !r)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition">
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : remaining === POMODORO_PRESETS[preset].seconds ? "Start" : "Resume"}
        </button>
        <button onClick={reset}
          className="p-2 rounded-xl bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 transition text-slate-600 dark:text-gray-300">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/20">
      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
              AI Study Hub
            </span>
          </div>
          {mounted && (
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 transition text-slate-600 dark:text-gray-300"
              title="Toggle dark mode">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500 mb-3">Your personal study assistant</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white leading-tight mb-4">
            Study smarter, not harder.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl">
            Upload your PDF or paste notes — every tool generates answers grounded strictly in your material, zero hallucination.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Tool grid — takes 3 cols */}
          <div className="lg:col-span-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {aiTools.map((tool) => (
                <button
                  key={tool.path}
                  onClick={() => navigate(tool.path)}
                  className={`group text-left bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg ${tool.glow} hover:-translate-y-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-4 shadow-md`}>
                    <tool.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{tool.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar: Pomodoro */}
          <div className="lg:col-span-1">
            <Pomodoro />
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-400 dark:text-slate-600 text-sm mt-16">
          Powered by Groq · OpenRouter · NVIDIA — all answers grounded to your uploaded material.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
