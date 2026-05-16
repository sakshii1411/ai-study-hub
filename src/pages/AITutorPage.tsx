/**
 * AITutorPage.tsx
 * AI Voice Tutor using browser Web Speech API (SpeechRecognition + SpeechSynthesis)
 * + Groq/OpenRouter for AI responses. 100% free, no external SDK required.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Mic, MicOff, PhoneOff, Volume2, VolumeX,
  MessageSquare, Brain, Loader2, CheckCircle,
} from "lucide-react";
import { callAI } from "@/lib/aiClient";

// Declare Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

type Screen = "subject" | "call";
type CallStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Message { role: "user" | "assistant"; text: string; }

const SUBJECTS = [
  "Teach me spoken English",
  "Help me practice Mathematics",
  "Explain Computer Science concepts",
  "Teach me Physics fundamentals",
  "Help me with Chemistry",
  "Quiz me on History & Geography",
  "Help me learn Data Science",
  "Explain Machine Learning concepts",
];

const SYSTEM_PROMPT = (subject: string) =>
  `You are an expert, friendly AI tutor helping a student learn: "${subject}".
Be encouraging, concise, and conversational. This is a voice conversation, so:
- Keep responses SHORT (2-4 sentences max).
- Ask follow-up questions to check understanding.
- Use simple, clear language.
- Avoid lists or bullet points — speak naturally.
- Be warm and supportive.`;

export default function AITutorPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("subject");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);
  const isMutedRef = useRef(false);
  const subjectRef = useRef("");
  const messagesRef = useRef<Message[]>([]);
  const activeRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Check browser support
  useEffect(() => {
    const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasSpeechSynthesis = !!window.speechSynthesis;
    if (!hasSpeechRecognition || !hasSpeechSynthesis) {
      setSupported(false);
      setErrorMsg("Your browser doesn't support voice features. Please use Chrome or Edge.");
    }
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, transcript]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.lang = "en-US";

    // Pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
    ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => { setCallStatus("listening"); onEnd?.(); };
    utterance.onerror = () => { setCallStatus("listening"); onEnd?.(); };
    setCallStatus("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (!activeRef.current || isMutedRef.current || isListeningRef.current) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setCallStatus("listening");
        setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[event.results.length - 1];
        const text = result[0].transcript;
        setTranscript(text);
        if (result.isFinal && text.trim()) {
          handleUserSpeech(text.trim());
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        recognitionRef.current = null;
        // Restart if still active and not muted
        if (activeRef.current && !isMutedRef.current && callStatus !== "thinking" && callStatus !== "speaking") {
          setTimeout(() => { if (activeRef.current) startListening(); }, 500);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        isListeningRef.current = false;
        if (event.error === "no-speech" || event.error === "aborted") {
          if (activeRef.current && !isMutedRef.current) {
            setTimeout(() => { if (activeRef.current) startListening(); }, 1000);
          }
          return;
        }
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone access denied. Please allow microphone access and try again.");
          setCallStatus("error");
          activeRef.current = false;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      isListeningRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUserSpeech = useCallback(async (text: string) => {
    if (!activeRef.current) return;

    // Stop recognition while processing
    recognitionRef.current?.stop();
    isListeningRef.current = false;
    setTranscript("");

    const userMsg: Message = { role: "user", text };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    messagesRef.current = newMessages;
    setCallStatus("thinking");

    try {
      // Build conversation history for context
      const historyPrompt = newMessages
        .slice(-6) // last 3 turns
        .map(m => `${m.role === "user" ? "Student" : "Tutor"}: ${m.text}`)
        .join("\n");

      const response = await callAI(
        `Conversation so far:\n${historyPrompt}\n\nStudent's latest message: "${text}"\n\nRespond as the tutor (2-4 sentences max, conversational):`,
        SYSTEM_PROMPT(subjectRef.current),
        0.8,
        300
      );

      const assistantMsg: Message = { role: "assistant", text: response };
      const updatedMessages = [...messagesRef.current, assistantMsg];
      setMessages(updatedMessages);
      messagesRef.current = updatedMessages;

      speak(response, () => {
        if (activeRef.current && !isMutedRef.current) {
          setTimeout(() => startListening(), 300);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI response failed.";
      setErrorMsg(msg);
      setCallStatus("error");
    }
  }, [speak, startListening]);

  const startCall = useCallback(async (chosenSubject: string) => {
    if (!supported) return;
    setErrorMsg("");
    setMessages([]);
    messagesRef.current = [];
    subjectRef.current = chosenSubject;
    activeRef.current = true;
    setScreen("call");
    setCallStatus("thinking");

    try {
      const greeting = await callAI(
        `You are starting a tutoring session on "${chosenSubject}". Greet the student warmly and ask one opening question to understand their current level. Keep it under 3 sentences.`,
        SYSTEM_PROMPT(chosenSubject),
        0.8, 200
      );

      const greetingMsg: Message = { role: "assistant", text: greeting };
      setMessages([greetingMsg]);
      messagesRef.current = [greetingMsg];

      speak(greeting, () => {
        if (activeRef.current) startListening();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start session.";
      setErrorMsg(msg);
      setCallStatus("error");
    }
  }, [supported, speak, startListening]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    isListeningRef.current = false;
    setCallStatus("idle");
    setScreen("subject");
    setMessages([]);
    setTranscript("");
    setErrorMsg("");
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (newMuted) {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setCallStatus("idle");
    } else {
      setTimeout(() => startListening(), 300);
    }
  }, [startListening]);

  const statusLabel = {
    idle: "Ready",
    listening: "🎤 Listening…",
    thinking: "🧠 Thinking…",
    speaking: "🔊 Speaking…",
    error: "⚠️ Error",
  }[callStatus];

  const statusColor = {
    idle: "text-gray-500",
    listening: "text-green-600",
    thinking: "text-blue-600",
    speaking: "text-purple-600",
    error: "text-red-600",
  }[callStatus];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { endCall(); navigate("/dashboard"); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <h1 className="text-base font-bold">AI Tutor</h1>
          {screen === "call" && (
            <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 ${statusColor}`}>
              {statusLabel}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        {/* Subject picker */}
        {screen === "subject" && (
          <div className="bg-white rounded-2xl shadow-lg border p-8 w-full max-w-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Mic className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-800">AI Voice Tutor</h2>
              <p className="text-gray-500 text-sm mt-1">Speak with a personal AI tutor in real time.</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 flex gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">
                Uses your browser's built-in voice features — <strong>no extra software needed</strong>. Works in Chrome and Edge.
              </p>
            </div>

            {!supported && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
                <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
              </div>
            )}

            <p className="text-sm font-semibold text-gray-700 mb-3">What would you like to study?</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSubject(s); startCall(s); }}
                  disabled={!supported}
                  className="text-left px-3 py-2.5 rounded-xl border-2 border-gray-200 hover:border-rose-400 hover:bg-rose-50 text-xs font-medium text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Or type a custom topic…"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="flex-1"
                disabled={!supported}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customSubject.trim() && supported) {
                    const s = customSubject.trim();
                    setSubject(s);
                    startCall(s);
                  }
                }}
              />
              <Button
                className="bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold"
                disabled={!customSubject.trim() || !supported}
                onClick={() => { const s = customSubject.trim(); setSubject(s); startCall(s); }}
              >
                Start
              </Button>
            </div>
          </div>
        )}

        {/* Live call */}
        {screen === "call" && (
          <div className="w-full max-w-2xl flex flex-col gap-4">
            {/* Status bar */}
            <div className="bg-white rounded-2xl shadow border p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">{subject}</p>
                <p className={`text-sm font-medium mt-0.5 ${statusColor}`}>{statusLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={toggleMute} className="rounded-full w-10 h-10 border-2">
                  {isMuted ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4 text-green-600" />}
                </Button>
                {callStatus === "speaking" ? (
                  <Button variant="outline" size="icon" onClick={() => { window.speechSynthesis?.cancel(); setCallStatus("listening"); setTimeout(() => startListening(), 300); }} className="rounded-full w-10 h-10">
                    <VolumeX className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center">
                    <Volume2 className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <Button onClick={endCall} className="px-4 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm">
                  <PhoneOff className="h-4 w-4 mr-1" /> End
                </Button>
              </div>
            </div>

            {/* Chat history */}
            <div ref={chatRef} className="bg-white rounded-2xl shadow border p-4 flex flex-col gap-3 min-h-[320px] max-h-[400px] overflow-y-auto">
              {messages.length === 0 && callStatus === "thinking" && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-rose-400" />
                    <p className="text-sm">Starting your session…</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Brain className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {/* Live transcript */}
              {transcript && callStatus === "listening" && (
                <div className="flex gap-2 justify-end opacity-60">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm bg-blue-100 text-blue-700 rounded-tr-sm italic">
                    {transcript}…
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Mic className="h-3.5 w-3.5 text-white animate-pulse" />
                  </div>
                </div>
              )}
              {callStatus === "thinking" && messages.length > 0 && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-gray-100 rounded-tl-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {errorMsg && callStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <p className="font-semibold">Error</p>
                <p className="mt-0.5">{errorMsg}</p>
                <button onClick={() => { setErrorMsg(""); setCallStatus("listening"); startListening(); }} className="text-xs text-blue-600 underline mt-2">
                  Try again
                </button>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              {isMuted
                ? "🔇 Microphone muted — click the mic button to unmute and start speaking."
                : callStatus === "listening"
                ? "🎤 Speak now — the tutor is listening to you."
                : callStatus === "speaking"
                ? "🔊 Tutor is speaking — click the stop button to interrupt."
                : "💬 Conversation in progress — you can speak after the tutor finishes."}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
