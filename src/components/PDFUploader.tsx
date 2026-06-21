/**
 * PDFUploader.tsx — Shared drag-and-drop uploader with OCR progress
 * Shows clear stage labels, progress bar, and no duplicate error messages.
 */
import React, { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, RefreshCw } from "lucide-react";
import { extractFileTextWithProgress, ExtractionResult } from "@/lib/extractFileText";

interface PDFUploaderProps {
  onExtracted: (text: string, result: ExtractionResult) => void;
  onError: (msg: string) => void;
  onReset?: () => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  compact?: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  text: "✓ Text extracted successfully",
  vision: "✓ Vision AI extraction complete",
  ocr: "✓ OCR extraction complete",
  hybrid: "✓ Hybrid extraction complete",
  plain: "✓ File read successfully",
};

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  onExtracted,
  onError,
  onReset,
  accept = ".pdf,.txt,.md,.docx",
  className = "",
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState("");
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [methodLabel, setMethodLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warning, setWarning] = useState("");

  const reset = useCallback(() => {
    setFile(null);
    setStage("");
    setPct(0);
    setStatus("idle");
    setMethodLabel("");
    setErrorMsg("");
    setWarning("");
    if (inputRef.current) inputRef.current.value = "";
    onReset?.();
  }, [onReset]);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setStatus("processing");
    setPct(5);
    setStage("Preparing…");
    setErrorMsg("");
    setWarning("");

    try {
      const result = await extractFileTextWithProgress(f, (s, p) => {
        setStage(s);
        setPct(p);
      });
      setMethodLabel(METHOD_LABELS[result.method] ?? "✓ Done");
      if (result.warning) setWarning(result.warning);
      setStatus("done");
      onExtracted(result.text, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Extraction failed.";
      setStatus("error");
      setErrorMsg(msg);
      // Call parent error handler — parent should NOT also show a toast for this
      onError(msg);
    }
  }, [onExtracted, onError]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const borderColor =
    status === "done" ? "border-green-400 dark:border-green-600" :
    status === "error" ? "border-red-400 dark:border-red-600" :
    dragOver ? "border-blue-400 dark:border-blue-600" :
    "border-slate-300 dark:border-gray-600";

  const bgColor =
    status === "done" ? "bg-green-50 dark:bg-green-950" :
    status === "error" ? "bg-red-50" :
    dragOver ? "bg-blue-50 dark:bg-blue-950" :
    "bg-slate-50 dark:bg-gray-800";

  // Stage label with friendly descriptions
  const stageLabel = (() => {
    if (stage.includes("Vision AI")) return "🔍 " + stage;
    if (stage.includes("OCR")) return "🔤 " + stage;
    if (stage.includes("Loading OCR")) return "⚙️ " + stage;
    if (stage.includes("Scanned PDF")) return "📷 " + stage;
    return stage;
  })();

  return (
    <div className={className}>
      <div
        className={`relative w-full border-2 border-dashed rounded-xl transition-all duration-200 ${borderColor} ${bgColor} ${compact ? "p-4" : "p-6"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {(status === "done" || status === "error") && (
          <button
            onClick={reset}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 transition rounded-full p-1 hover:bg-slate-100 dark:hover:bg-gray-700"
            title="Remove file and try again"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <label htmlFor="pdf-uploader-input" className={`flex flex-col items-center gap-3 ${status !== "processing" ? "cursor-pointer" : "cursor-not-allowed"} select-none`}>
          {/* Icon */}
          {status === "idle" && <Upload className={`text-slate-400 ${compact ? "h-6 w-6" : "h-8 w-8"}`} />}
          {status === "processing" && <Loader2 className={`text-blue-500 animate-spin ${compact ? "h-6 w-6" : "h-8 w-8"}`} />}
          {status === "done" && <CheckCircle className={`text-green-500 ${compact ? "h-6 w-6" : "h-8 w-8"}`} />}
          {status === "error" && <AlertCircle className={`text-red-500 ${compact ? "h-6 w-6" : "h-8 w-8"}`} />}

          <div className="text-center w-full">
            {status === "idle" && (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {compact ? "Click or drag & drop" : "Click to upload or drag & drop"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">PDF, TXT, DOCX, MD · max 20 MB</p>
              </>
            )}
            {status === "processing" && (
              <>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{stageLabel}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs mx-auto">{file?.name}</p>
              </>
            )}
            {status === "done" && (
              <>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">{methodLabel}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <FileText className="inline h-3 w-3 mr-0.5" />
                  {file?.name}
                </p>
                {warning && (
                  <p className="text-xs text-amber-600 mt-1">⚠ {warning}</p>
                )}
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Extraction failed</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs mx-auto">{file?.name}</p>
              </>
            )}
          </div>

          {/* Progress bar */}
          {status === "processing" && (
            <div className="w-full max-w-xs">
              <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 text-center mt-1">{pct}%</p>
            </div>
          )}

          <input
            ref={inputRef}
            id="pdf-uploader-input"
            type="file"
            accept={accept}
            className="sr-only"
            onChange={handleFileChange}
            disabled={status === "processing"}
          />
        </label>
      </div>

      {/* Error detail box — shown once here, parent should NOT re-show */}
      {status === "error" && errorMsg && (
        <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <div className="flex-1">
            <span>{errorMsg}</span>
            <button
              onClick={reset}
              className="ml-2 underline text-red-600 hover:text-red-800 inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFUploader;
