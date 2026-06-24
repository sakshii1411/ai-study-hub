import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef, useCallback } from "react";
import { APIKeyChecker } from "@/components/APIKeyChecker";
import {
  BookOpen, Brain, FileText, ImageIcon, Lightbulb,
  MessageSquare, MessageSquareQuote, Target, Sparkles,
  Moon, Sun, Timer, Pause, Play, RotateCcw, CalendarDays,
  Plus, ChevronRight, Trash2,
} from "lucide-react";

const aiTools = [
  { title: "Notes Maker",        description: "Generate structured study notes from your PDF.",      path: "/notes-maker",     icon: FileText,         gradient: "from-blue-500 to-blue-600",     glow: "hover:shadow-blue-200 dark:hover:shadow-blue-900" },
  { title: "Q&A Assistant",      description: "Ask questions grounded strictly in your material.",   path: "/qna-component",   icon: MessageSquareQuote, gradient: "from-emerald-500 to-green-600", glow: "hover:shadow-emerald-200 dark:hover:shadow-emerald-900" },
  { title: "Theory Memorizer",   description: "Mnemonics and mind maps to lock in key concepts.",    path: "/theory-memorizer",icon: Brain,             gradient: "from-violet-500 to-purple-600", glow: "hover:shadow-violet-200 dark:hover:shadow-violet-900" },
  { title: "Flashcards",         description: "Study with AI flashcards + spaced repetition.",       path: "/flashcard",       icon: BookOpen,          gradient: "from-orange-500 to-orange-600", glow: "hover:shadow-orange-200 dark:hover:shadow-orange-900" },
  { title: "MCQ Generator",      description: "Test yourself with multiple-choice questions.",       path: "/mcq",             icon: Target,            gradient: "from-red-500 to-rose-600",      glow: "hover:shadow-red-200 dark:hover:shadow-red-900" },
  { title: "Subjective Practice",description: "Long-form answers with AI evaluation and feedback.", path: "/subjective",      icon: Lightbulb,         gradient: "from-amber-500 to-yellow-600",  glow: "hover:shadow-amber-200 dark:hover:shadow-amber-900" },
  { title: "Theory to Visual",   description: "Convert concepts into beautiful 3D diagrams.",        path: "/image-generator", icon: ImageIcon,         gradient: "from-pink-500 to-fuchsia-600",  glow: "hover:shadow-pink-200 dark:hover:shadow-pink-900" },
  { title: "AI Tutor",           description: "Chat with a personal AI tutor in real time.",         path: "/ai-tutor",        icon: MessageSquare,     gradient: "from-teal-500 to-cyan-600",     glow: "hover:shadow-teal-200 dark:hover:shadow-teal-900" },
  { title: "Study Planner",      description: "AI-generated study plans with daily schedules.",      path: "/create-plan",     icon: CalendarDays,      gradient: "from-indigo-500 to-blue-600",   glow: "hover:shadow-indigo-200 dark:hover:shadow-indigo-900" },
];

const POMODORO_PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "5 min",  seconds: 5  * 60 },
  { label: "15 min", seconds: 15 * 60 },
];

// ── Pomodoro ─────────────────────────────────────────────────────────────────
function Pomodoro() {
  const [preset, setPreset]       = useState(0);
  const [remaining, setRemaining] = useState(POMODORO_PRESETS[0].seconds);
  const [running, setRunning]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(intervalRef.current!); intervalRef.current = null; setRunning(false); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [running]);

  const selectPreset = (i: number) => { setPreset(i); setRemaining(POMODORO_PRESETS[i].seconds); setRunning(false); };
  const reset = () => { setRemaining(POMODORO_PRESETS[preset].seconds); setRunning(false); };
  const mm  = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss  = String(remaining % 60).padStart(2, "0");
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
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-gray-700" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              strokeLinecap="round" className="text-indigo-500 transition-all duration-1000" />
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

// ── My Plans widget ───────────────────────────────────────────────────────────
interface ExamPlan { id: string; subjectName: string; examType: string; examDate?: string; }

function MyPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ExamPlan[]>([]);

  useEffect(() => {
    try { setPlans(JSON.parse(localStorage.getItem("examPlans") || "[]")); }
    catch { setPlans([]); }
  }, []);

  const deletePlan = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = plans.filter(p => p.id !== id);
    setPlans(updated);
    localStorage.setItem("examPlans", JSON.stringify(updated));
  }, [plans]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-500" />
          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">My Study Plans</span>
        </div>
        <button onClick={() => navigate("/create-plan")}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">No plans yet</p>
          <button onClick={() => navigate("/create-plan")}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Create your first plan →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.slice(0, 4).map(plan => {
            const daysLeft = plan.examDate
              ? Math.max(0, Math.ceil((new Date(plan.examDate).getTime() - Date.now()) / 86400000))
              : null;
            return (
              <div key={plan.id}
                onClick={() => navigate(`/plan/${plan.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer transition group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{plan.subjectName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{plan.examType}
                    {daysLeft !== null && (
                      <span className={`ml-1.5 font-semibold ${daysLeft <= 7 ? "text-red-500" : daysLeft <= 14 ? "text-orange-500" : "text-green-600"}`}>
                        · {daysLeft}d left
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={e => deletePlan(e, plan.id)}
                    className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-slate-300 hover:text-red-500 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                </div>
              </div>
            );
          })}
          {plans.length > 4 && (
            <button onClick={() => navigate("/create-plan")}
              className="w-full text-xs text-center text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition">
              +{plans.length - 4} more plans
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/20">
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
        <APIKeyChecker />

        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500 mb-3">Your personal study assistant</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white leading-tight mb-4">
            Study smarter, not harder.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl">
            Upload your PDF or paste notes — every tool generates answers grounded strictly in your material.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar — top on mobile, right on desktop */}
          <div className="lg:col-span-1 lg:order-last order-first">
            <Pomodoro />
            <MyPlans />
          </div>

          {/* Tool grid */}
          <div className="lg:col-span-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {aiTools.map((tool, idx) => (
                <button
                  key={tool.path}
                  onClick={() => navigate(tool.path)}
                  style={{ animationDelay: `${idx * 55}ms` }}
                  className={`group text-left bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 opacity-0 animate-[fadeUp_0.4s_ease_forwards] ${tool.glow}`}
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
        </div>

        <p className="text-center text-slate-400 dark:text-slate-600 text-sm mt-16">
          Powered by Groq · OpenRouter · NVIDIA — all answers grounded to your uploaded material.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
