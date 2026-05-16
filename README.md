# AI Study Hub

An AI-powered study platform that generates notes, flashcards, MCQs, Q&A answers, and visualizations from your PDFs and notes.

## Features

- **Notes Maker** — Generate summary, detailed, exam-focused, or flashcard notes from PDFs
- **Q&A Assistant** — Ask questions answered strictly from your uploaded material
- **Theory Memorizer** — Generate mnemonics and mind maps
- **Flashcard Game** — Interactive flip-card study sessions with PDF export
- **MCQ Generator** — Auto-generated multiple choice quizzes from your docs
- **Subjective Practice** — Long-form answer practice with AI evaluation
- **Theory to Visual** — Convert concepts into SVG diagrams (flowcharts, mind maps, timelines)
- **AI Tutor** — Real-time voice AI tutor

## PDF Pipeline

The app uses a **3-stage hybrid extraction pipeline**:

1. **pdfjs-dist** — extracts text layers from regular PDFs
2. **Intelligent quality scoring** — detects if extraction was good (word ratio, character diversity, sentence structure)
3. **Tesseract.js OCR fallback** — automatically triggered for scanned/image-based PDFs

Supported file types: **PDF, TXT, DOCX, MD** (up to 15 MB)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

Copy `.env.example` to `.env` and fill in at least one AI provider key:

```bash
cp .env.example .env
```

You need **at least one** of:
- `VITE_GROQ_API_KEY` — get free at https://console.groq.com (recommended, fastest)
- `VITE_OPENROUTER_API_KEY` — get at https://openrouter.ai
- `VITE_NVIDIA_API_KEY` — get at https://build.nvidia.com

Optional (for AI Tutor voice feature):
- `VITE_VAPI_API_KEY`

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:8080

### 4. Build for production

```bash
npm run build
```

## Deploy on Render (Static Site)

1. Push this project to GitHub
2. Go to https://render.com → New → Static Site
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. Add environment variables (same as `.env`) in the Render dashboard
6. Deploy

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GROQ_API_KEY` | Recommended | Groq LLaMA API (fastest, free tier) |
| `VITE_OPENROUTER_API_KEY` | Optional | OpenRouter multi-model API |
| `VITE_NVIDIA_API_KEY` | Optional | NVIDIA NIM API |
| `VITE_VAPI_API_KEY` | Optional | VAPI voice AI (AI Tutor feature) |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **PDF Extraction:** pdfjs-dist + Tesseract.js (OCR)
- **AI:** Groq / OpenRouter / NVIDIA (configurable, with automatic fallback)
- **Diagrams:** Custom SVG generation + ReactFlow
