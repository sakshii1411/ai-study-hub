import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

const aiTools = [
  {
    title: "Notes Maker",
    description: "Generate structured study notes from your PDF or text.",
    path: "/notes-maker",
    icon: FileText,
    gradient: "from-blue-500 to-blue-600",
    glow: "hover:shadow-blue-200",
  },
  {
    title: "Q&A Assistant",
    description: "Ask questions and get grounded answers from your material.",
    path: "/qna-component",
    icon: MessageSquareQuote,
    gradient: "from-emerald-500 to-green-600",
    glow: "hover:shadow-emerald-200",
  },
  {
    title: "Theory Memorizer",
    description: "Generate mnemonics and mind maps to lock in key concepts.",
    path: "/theory-memorizer",
    icon: Brain,
    gradient: "from-violet-500 to-purple-600",
    glow: "hover:shadow-violet-200",
  },
  {
    title: "Flashcards",
    description: "Create and study with AI-generated interactive flashcards.",
    path: "/flashcard",
    icon: BookOpen,
    gradient: "from-orange-500 to-orange-600",
    glow: "hover:shadow-orange-200",
  },
  {
    title: "MCQ Generator",
    description: "Test yourself with multiple-choice questions from your PDF.",
    path: "/mcq",
    icon: Target,
    gradient: "from-red-500 to-rose-600",
    glow: "hover:shadow-red-200",
  },
  {
    title: "Subjective Practice",
    description: "Practice long-form answers with AI evaluation and feedback.",
    path: "/subjective",
    icon: Lightbulb,
    gradient: "from-amber-500 to-yellow-600",
    glow: "hover:shadow-amber-200",
  },
  {
    title: "Image Generator",
    description: "Visualise complex theories as AI-generated diagrams.",
    path: "/image-generator",
    icon: ImageIcon,
    gradient: "from-pink-500 to-fuchsia-600",
    glow: "hover:shadow-pink-200",
  },
  {
    title: "AI Tutor",
    description: "Speak with a personal AI tutor in real time.",
    path: "/ai-tutor",
    icon: MessageSquare,
    gradient: "from-teal-500 to-cyan-600",
    glow: "hover:shadow-teal-200",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
            AI Study Hub
          </span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500 mb-3">
            Your personal study assistant
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 leading-tight mb-4">
            Study smarter, not harder.
          </h1>
          <p className="text-slate-500 text-lg max-w-xl">
            Upload your PDF or paste notes — every tool generates answers
            grounded strictly in your material, zero hallucination.
          </p>
        </div>

        {/* Tool grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {aiTools.map((tool) => (
            <button
              key={tool.path}
              onClick={() => navigate(tool.path)}
              className={`group text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg ${tool.glow} hover:-translate-y-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-4 shadow-md`}
              >
                <tool.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-blue-600 transition-colors">
                {tool.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {tool.description}
              </p>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-400 text-sm mt-16">
          Powered by Groq · OpenRouter · NVIDIA — all answers grounded to your
          uploaded material.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
