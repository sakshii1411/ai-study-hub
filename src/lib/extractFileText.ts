/**
 * extractFileText.ts — Production-grade PDF/file text extraction
 *
 * Pipeline:
 * 1. pdfjs text layer
 * 2. Vision AI (OpenRouter free models) if text quality poor
 * 3. Tesseract.js browser OCR as final fallback
 * Never fails unless ALL three methods fail.
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_PAGES = 50;
const VISION_PAGE_LIMIT = 15;
const OCR_PAGE_LIMIT = 10;
const RENDER_SCALE = 2.0;
const QUALITY_THRESHOLD = 0.3;

const VISION_MODELS = [
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "qwen/qwen2-vl-7b-instruct:free",
  "microsoft/phi-3-vision-128k-instruct:free",
];

const OPENROUTER_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY ?? "";

function scoreTextQuality(text: string): number {
  if (!text || text.length < 20) return 0;
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 4) return 0;
  const readable = words.filter((w) => /[a-zA-Z]{2,}/.test(w));
  const wordRatio = readable.length / words.length;
  const uniqueChars = new Set(text.replace(/\s/g, "")).size;
  const diversity = Math.min(uniqueChars / 25, 1);
  const printable = (text.match(/[\x20-\x7E]/g) ?? []).length;
  const printableRatio = printable / text.length;
  const avgLen = readable.reduce((a, w) => a + w.length, 0) / Math.max(readable.length, 1);
  const avgScore = avgLen >= 2 && avgLen <= 15 ? 1 : 0.4;
  return wordRatio * 0.4 + diversity * 0.2 + printableRatio * 0.25 + avgScore * 0.15;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]{4,}/g, "   ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

let _pdfjsLib: any = null;
async function getPdfjs(): Promise<any> {
  if (_pdfjsLib) return _pdfjsLib;
  const lib: any = await import("pdfjs-dist");
  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url);
    lib.GlobalWorkerOptions.workerSrc = workerUrl.toString();
  } catch {
    lib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
  }
  _pdfjsLib = lib;
  return lib;
}

async function openPdf(buffer: ArrayBuffer): Promise<any> {
  const lib = await getPdfjs();
  const v = lib.version as string;
  const opts = { data: new Uint8Array(buffer), disableRange: true, disableStream: true, disableAutoFetch: true, useWorkerFetch: false };
  const srcs = [
    lib.GlobalWorkerOptions.workerSrc as string,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`,
    `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`,
    "",
  ];
  for (const src of [...new Set(srcs)]) {
    try {
      lib.GlobalWorkerOptions.workerSrc = src;
      const pdf = await Promise.race([
        lib.getDocument(opts).promise,
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 18000)),
      ]);
      if (pdf) return pdf;
    } catch (e: unknown) {
      if (String(e).toLowerCase().includes("password"))
        throw new Error("PDF is password-protected. Please upload an unlocked version.");
    }
  }
  throw new Error("Could not open PDF.");
}

async function extractWithPdfjs(buffer: ArrayBuffer) {
  const pdf = await openPdf(buffer);
  const pageCount: number = pdf.numPages;
  const parts: string[] = [];
  for (let p = 1; p <= Math.min(pageCount, MAX_PAGES); p++) {
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items
        .map((it: any) => (it.str ?? "") + (it.hasEOL ? "\n" : " "))
        .join("").replace(/[ \t]+/g, " ").trim();
      if (text.length > 0) parts.push(text);
    } catch { /* skip */ }
  }
  const combined = parts.join("\n\n").trim();
  return { text: combined, pageCount, quality: scoreTextQuality(combined), pdf };
}

async function renderPageToCanvas(page: any): Promise<HTMLCanvasElement | null> {
  try {
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } catch { return null; }
}

async function renderToBase64(page: any): Promise<string | null> {
  const canvas = await renderPageToCanvas(page);
  return canvas ? canvas.toDataURL("image/jpeg", 0.88).split(",")[1] : null;
}

async function callVisionModel(b64: string): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("no key");
  for (const model of VISION_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
          "X-Title": "AI Study Hub",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
            { type: "text", text: "Extract ALL visible text from this image exactly as it appears. Include headings, paragraphs, bullet points, numbers, formulas, tables. Preserve reading order. Return ONLY the extracted text, no commentary." },
          ]}],
          max_tokens: 2500,
        }),
      });
      if (!res.ok) { if (res.status === 429 || res.status === 402) continue; continue; }
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (text.trim().length > 10) return text.trim();
    } catch { continue; }
  }
  throw new Error("All vision models failed.");
}

async function extractWithVisionAI(pdf: any, onProgress?: (s: string, p: number) => void): Promise<string> {
  const total = Math.min(pdf.numPages as number, VISION_PAGE_LIMIT);
  const parts: string[] = [];
  for (let p = 1; p <= total; p++) {
    onProgress?.(`Vision AI reading page ${p}/${total}…`, 35 + Math.round((p / total) * 38));
    try {
      const page = await pdf.getPage(p);
      const b64 = await renderToBase64(page);
      if (!b64) continue;
      const text = await callVisionModel(b64);
      if (text) parts.push(text);
      await new Promise((r) => setTimeout(r, 150));
    } catch { /* skip */ }
  }
  if (parts.length === 0) throw new Error("Vision AI produced no text.");
  return parts.join("\n\n").trim();
}

let _tesseractWorker: any = null;
async function getTesseractWorker(): Promise<any> {
  if (_tesseractWorker) return _tesseractWorker;
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
  _tesseractWorker = worker;
  return worker;
}

async function extractWithTesseract(pdf: any, onProgress?: (s: string, p: number) => void): Promise<string> {
  const total = Math.min(pdf.numPages as number, OCR_PAGE_LIMIT);
  const parts: string[] = [];
  onProgress?.("Loading OCR engine (first time may take ~15s)…", 76);
  const worker = await getTesseractWorker();
  for (let p = 1; p <= total; p++) {
    onProgress?.(`OCR scanning page ${p}/${total}…`, 78 + Math.round((p / total) * 18));
    try {
      const page = await pdf.getPage(p);
      const canvas = await renderPageToCanvas(page);
      if (!canvas) continue;
      const { data } = await worker.recognize(canvas);
      if (data.text?.trim().length > 5) parts.push(data.text.trim());
    } catch { /* skip */ }
  }
  if (parts.length === 0) throw new Error("OCR produced no readable text.");
  return parts.join("\n\n").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import("mammoth");
  const ab = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  if (!result.value?.trim()) throw new Error("No readable text found in DOCX.");
  return result.value.trim();
}

export interface ExtractionResult {
  text: string;
  method: "text" | "vision" | "ocr" | "hybrid" | "plain";
  quality: number;
  pageCount?: number;
  warning?: string;
}

export async function extractFileTextWithProgress(
  file: File,
  onProgress?: (stage: string, pct: number) => void
): Promise<ExtractionResult> {
  if (!file) throw new Error("No file provided.");
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`File too large (${(file.size / 1048576).toFixed(1)} MB). Max is 20 MB.`);

  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "text/plain" || type === "text/markdown" || name.endsWith(".txt") || name.endsWith(".md")) {
    onProgress?.("Reading file…", 50);
    const text = cleanText(await file.text());
    if (text.length < 10) throw new Error("File is empty.");
    onProgress?.("Done", 100);
    return { text, method: "plain", quality: 1 };
  }

  if (type.includes("wordprocessingml") || name.endsWith(".docx")) {
    onProgress?.("Reading Word document…", 40);
    const text = cleanText(await extractDocx(file));
    onProgress?.("Done", 100);
    return { text, method: "plain", quality: 1 };
  }

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    onProgress?.("Loading PDF…", 10);
    const buffer = await file.arrayBuffer();

    // Stage 1: pdfjs
    onProgress?.("Extracting text layer…", 20);
    let pdfData = { text: "", pageCount: 0, quality: 0, pdf: null as any };
    try {
      pdfData = await extractWithPdfjs(buffer);
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("password")) throw new Error(msg);
    }

    if (pdfData.quality >= QUALITY_THRESHOLD && pdfData.text.length >= 80) {
      onProgress?.("Done", 100);
      return { text: cleanText(pdfData.text), method: "text", quality: pdfData.quality, pageCount: pdfData.pageCount };
    }

    // Stage 2: Vision AI
    onProgress?.("Scanned PDF detected — trying Vision AI…", 33);
    let visionText = "";
    let visionFailed = false;
    try {
      const pdf = pdfData.pdf ?? (await openPdf(buffer));
      pdfData.pdf = pdf;
      visionText = await extractWithVisionAI(pdf, onProgress);
    } catch { visionFailed = true; }

    if (!visionFailed && visionText.length >= 80) {
      const hybrid = pdfData.text.length >= 40 ? visionText + "\n\n" + pdfData.text : visionText;
      const cleaned = cleanText(hybrid);
      onProgress?.("Done", 100);
      return { text: cleaned, method: pdfData.text.length >= 40 ? "hybrid" : "vision", quality: scoreTextQuality(cleaned), pageCount: pdfData.pageCount };
    }

    // Stage 3: Tesseract OCR
    onProgress?.("Vision AI unavailable — starting browser OCR…", 74);
    let ocrText = "";
    let ocrFailed = false;
    try {
      const pdf = pdfData.pdf ?? (await openPdf(buffer));
      pdfData.pdf = pdf;
      ocrText = await extractWithTesseract(pdf, onProgress);
    } catch { ocrFailed = true; }

    onProgress?.("Finalising…", 97);

    const hasPdf = pdfData.text.length >= 40;
    const hasOcr = ocrText.length >= 40;
    const hasVision = visionText.length >= 40;

    let finalText = "";
    let method: ExtractionResult["method"] = "ocr";

    if (hasOcr && hasPdf) { finalText = ocrText + "\n\n" + pdfData.text; method = "hybrid"; }
    else if (hasOcr) { finalText = ocrText; method = "ocr"; }
    else if (hasVision) { finalText = visionText; method = "vision"; }
    else if (hasPdf) { finalText = pdfData.text; method = "text"; }
    else {
      throw new Error(
        ocrFailed && visionFailed
          ? "All extraction methods failed. The PDF may be blank or corrupted. Please paste content manually."
          : "Could not extract enough text. Please paste the content manually."
      );
    }

    const cleaned = cleanText(finalText);
    onProgress?.("Done", 100);
    return {
      text: cleaned, method, quality: scoreTextQuality(cleaned), pageCount: pdfData.pageCount,
      warning: scoreTextQuality(cleaned) < 0.25 ? "Extraction quality may be low — please review results." : undefined,
    };
  }

  throw new Error("Unsupported file type. Please upload PDF, TXT, DOCX, or MD.");
}

export async function extractFileText(file: File): Promise<string> {
  return (await extractFileTextWithProgress(file)).text;
}
export async function extractFileTextDetailed(file: File): Promise<ExtractionResult> {
  return extractFileTextWithProgress(file);
}
