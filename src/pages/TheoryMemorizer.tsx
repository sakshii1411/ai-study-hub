/**
 * TheoryMemorizer.tsx  —  fixed
 * - Uses ReactMarkdown for mnemonic + explanation (kills raw ====, ----, #### artefacts)
 * - callAI / callAIJson replace all Gemini calls
 * - extractFileText for PDF uploads
 */
import React, { useState, useRef, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader, Map, Sparkles, Lightbulb, Mic, Play, Pause,
  Volume2, BookOpen, FileText, Brain, ChevronRight, Download, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";
import { callAI, callAIJson, callAIStream } from "@/lib/aiClient";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { extractFileText } from "@/lib/extractFileText";
import RealMindMap from "@/components/RealMindMap";

function cn(...inputs: (string | boolean | null | undefined)[]) {
  return twMerge(clsx(inputs));
}

interface MindMapBranch { label: string; notes?: string; subBranches?: string[]; }
interface MindMapData   { title: string; branches: MindMapBranch[]; }

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ── tiny Button ─────────────────────────────────────────────────────── */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:   "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30",
        outline:   "border border-input bg-background hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:     "hover:bg-accent/10 hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-12 rounded-lg px-8 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {}
const Btn = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Btn.displayName = "Btn";

/* ── Textarea ─────────────────────────────────────────────────────────── */
const StyledTextarea = forwardRef<
  HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
      "ring-offset-background placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
      className
    )}
    {...props}
  />
));
StyledTextarea.displayName = "StyledTextarea";

/* ── Empty state ──────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, desc }: {
  icon: React.ElementType; title: string; desc: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-20 text-muted-foreground gap-4">
      <Icon className="h-12 w-12 opacity-20" />
      <div>
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm mt-1 max-w-xs">{desc}</p>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────── */
const TheoryMemorizer: React.FC = () => {
  const navigate   = useNavigate();
  const fileRef    = useRef<HTMLInputElement>(null);

  const [inputText,        setInputText]        = useState("");
  const [isLoading,        setIsLoading]        = useState(false);
  const [activeTab,        setActiveTab]        = useState<"mnemonic"|"mindmap"|"explanation">("mnemonic");
  const [mnemonicResult,   setMnemonicResult]   = useState("");
  const [mindMapData,      setMindMapData]      = useState<MindMapData|null>(null);
  const [explanationResult,setExplanationResult]= useState("");
  const [isSpeaking,       setIsSpeaking]       = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance|null>(null);

  const stopSpeech = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const text = await extractFileText(file);
      setInputText(text);
      toast.success("File loaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to read file.");
    } finally {
      setIsLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generateMnemonic = async () => {
    setIsLoading(true); stopSpeech(); setMnemonicResult("");
    try {
      let accumulated = "";
      await callAIStream(
        `Create a memorable mnemonic, acronym, or memory aid for the following content.
Include: a catchy acronym or phrase, a short story or visual association, and key points to remember.
Use clean Markdown formatting with ## headings and bullet points.

CONTENT:
${inputText.slice(0, 20000)}`,
        (chunk) => { accumulated += chunk; setMnemonicResult(accumulated); },
        "You are an expert memory coach. Create highly memorable, creative memory aids. Use Markdown only.",
        0.8, 2000
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally { setIsLoading(false); }
  };

  const generateMindMap = async () => {
    setIsLoading(true); stopSpeech();
    try {
      const prompt = `Analyze the following study content and create a structured mind map.

Return ONLY a raw JSON object. No markdown, no backticks, no explanation, no text before or after the JSON.

The JSON must exactly match this structure:
{
  "title": "Short Main Topic",
  "branches": [
    {
      "label": "Branch Name",
      "notes": "One clear sentence about this branch.",
      "subBranches": ["Sub-topic 1", "Sub-topic 2", "Sub-topic 3"]
    }
  ]
}

Requirements: exactly 4-5 branches, each with 3-4 subBranches. All values must be strings.

STUDY CONTENT:
${inputText.slice(0, 18000)}

JSON only:`;

      const raw = await callAI(prompt,
        "You are a JSON-only API. Output ONLY valid JSON with no markdown, no backticks, no explanation.",
        0.2, 2000
      );

      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) throw new Error("AI did not return valid JSON.");
      const data = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as MindMapData;

      if (!data?.title || !Array.isArray(data?.branches) || data.branches.length === 0) {
        throw new Error("Mind map is missing required fields.");
      }
      data.branches = data.branches.map((b) => ({
        label: b.label || "Topic",
        notes: b.notes || "",
        subBranches: Array.isArray(b.subBranches) ? b.subBranches : [],
      }));
      setMindMapData(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Mind map generation failed.");
    } finally { setIsLoading(false); }
  };

  const generateExplanation = async () => {
    setIsLoading(true); stopSpeech(); setExplanationResult("");
    try {
      let accumulated = "";
      await callAIStream(
        `Explain the following content clearly and professionally for a student.

FORMAT RULES — FOLLOW EXACTLY:
- Start with a bold one-line overview sentence
- Use ## for main section headings (e.g. ## Key Concepts)
- Use ### for sub-headings
- Use bullet points (- item) for lists — ALWAYS use bullets, never plain lines
- Use **bold** for key terms
- Use numbered lists (1. 2. 3.) for steps or sequences
- End with a ## Summary section with 3-5 bullet points
- NO separator lines (===, ---, ***), NO raw text walls

CONTENT:
${inputText.slice(0, 20000)}`,
        (chunk) => { accumulated += chunk; setExplanationResult(accumulated); },
        "You are a professional academic teacher. Always use clean Markdown with proper ## headings, - bullet points, and **bold** key terms. Never output raw unformatted paragraphs. Never use === or --- separator lines.",
        0.7, 2500
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally { setIsLoading(false); }
  };

  const handleGenerate = () => {
    if (!inputText.trim()) { toast.error("Please enter or upload content first."); return; }
    if (activeTab === "mnemonic")    generateMnemonic();
    else if (activeTab === "mindmap") generateMindMap();
    else                              generateExplanation();
  };

  const stripMarkdownForSpeech = (text: string): string => {
    return text
      // Remove ATX headings (## Heading → "Heading")
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic (**text** → text, *text* → text, __text__ → text)
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      // Remove markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove setext headings (underlines)
      .replace(/^[=\-]{3,}\s*$/gm, "")
      // Remove horizontal rules
      .replace(/^[*\-_]{3,}\s*$/gm, "")
      // Remove bullet markers at line start (- item or * item → item)
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // Remove numbered list markers (1. item → item)
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const handleSpeak = (text: string) => {
    if (!("speechSynthesis" in window)) { toast.error("Text-to-speech not supported."); return; }
    if (isSpeaking) { stopSpeech(); return; }
    const cleanText = stripMarkdownForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    utterance.onend  = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const tabs = [
    { id: "mnemonic"    as const, label: "Mnemonic",    icon: Brain },
    { id: "mindmap"     as const, label: "Mind Map",    icon: Map },
    { id: "explanation" as const, label: "Explanation", icon: Lightbulb },
  ];

  /* ── Shared prose section ───────────────────────────────────────────── */
  const ProseSection = ({ content, title, icon: Icon }: {
    content: string; title: string; icon: React.ElementType;
  }) => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" /> {title}
        </h2>
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={() => handleSpeak(content)} title={isSpeaking ? "Stop" : "Read aloud"}>
            {isSpeaking ? <><Pause className="h-4 w-4"/><Volume2 className="h-4 w-4"/></> : <><Play className="h-4 w-4"/><Mic className="h-4 w-4"/></>}
          </Btn>
          <Btn size="sm" variant="outline" onClick={() => downloadText(content, `${title.toLowerCase()}.md`)} title="Download">
            <Download className="h-4 w-4" />
          </Btn>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 pr-1">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Btn variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Btn>
          <h1 className="text-base font-bold">Theory Memorizer</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8">

          {/* ── Input panel ── */}
          <div className="space-y-5">
            <div className="bg-card rounded-2xl border shadow-sm p-5">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" /> Study Material
              </h2>
              <StyledTextarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Paste theory, notes, or a concept to memorize…"
                className="min-h-[180px] mb-3"
              />
              <label htmlFor="tm-file"
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition text-sm text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Upload PDF or text file
                <input id="tm-file" type="file" accept=".pdf,.txt,.md" className="sr-only"
                  ref={fileRef} onChange={handleFileUpload} />
              </label>
            </div>

            {/* Mode tabs */}
            <div className="bg-card rounded-2xl border shadow-sm p-5">
              <p className="text-sm font-bold text-foreground mb-3">Generation Mode</p>
              <div className="space-y-2">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                      activeTab === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/30"
                    )}>
                    <t.icon className="h-4 w-4" />
                    {t.label}
                    <ChevronRight className={cn("h-4 w-4 ml-auto transition-transform", activeTab === t.id && "rotate-90")} />
                  </button>
                ))}
              </div>
              <Btn onClick={handleGenerate} disabled={isLoading || !inputText.trim()} className="w-full mt-4">
                {isLoading
                  ? <><Loader className="h-4 w-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="h-4 w-4" /> Generate</>}
              </Btn>
            </div>
          </div>

          {/* ── Output panel ── */}
          <div className="bg-card rounded-2xl border shadow-sm p-6 min-h-[500px] flex flex-col">
            {activeTab === "mnemonic" && (
              mnemonicResult
                ? <ProseSection content={mnemonicResult} title="Memory Aid" icon={Brain} />
                : <EmptyState icon={Brain} title="Memory Aid" desc='Click "Generate" to create a mnemonic.' />
            )}
            {activeTab === "mindmap" && (
              mindMapData
                ? <>
                    <h2 className="font-bold text-lg flex items-center gap-2 mb-4 shrink-0">
                      <Map className="h-5 w-5 text-primary" /> Mind Map
                    </h2>
                    <div className="flex-1 overflow-hidden">
                      <RealMindMap data={mindMapData} />
                    </div>
                  </>
                : <EmptyState icon={Map} title="Mind Map" desc='Click "Generate" to create a visual mind map.' />
            )}
            {activeTab === "explanation" && (
              explanationResult
                ? <ProseSection content={explanationResult} title="Explanation" icon={BookOpen} />
                : <EmptyState icon={Lightbulb} title="Simple Explanation" desc='Click "Generate" to get a clear explanation.' />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TheoryMemorizer;
