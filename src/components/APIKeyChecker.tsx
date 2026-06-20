/**
 * APIKeyChecker.tsx
 * Shows a friendly banner if no API keys are configured.
 * Displayed once at the top of Dashboard — nowhere else.
 */
import { useState, useEffect } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY ?? "";
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY ?? "";
const NVIDIA_KEY = import.meta.env.VITE_NVIDIA_API_KEY ?? "";

export function APIKeyChecker() {
  const [dismissed, setDismissed] = useState(false);
  const hasAnyKey = GROQ_KEY || OPENROUTER_KEY || NVIDIA_KEY;

  useEffect(() => {
    const prev = sessionStorage.getItem("api-key-banner-dismissed");
    if (prev) setDismissed(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("api-key-banner-dismissed", "1");
    setDismissed(true);
  };

  if (hasAnyKey || dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-2xl p-4 flex items-start gap-3 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">No API keys configured</p>
        <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
          AI features won't work without at least one API key. Add them to your <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded font-mono">.env</code> file.
        </p>
        <div className="flex flex-wrap gap-3 mt-2">
          {[
            { name: "Groq (fastest, free)", url: "https://console.groq.com" },
            { name: "OpenRouter (vision + fallback)", url: "https://openrouter.ai" },
            { name: "NVIDIA NIM", url: "https://build.nvidia.com" },
          ].map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100">
              {link.name} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
      <button onClick={dismiss} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
