# 🧠 AI Study Hub

> Your all-in-one AI-powered study companion — upload notes, generate summaries, flashcards, MCQs, diagrams, and more.

**Live Demo → [ai-study-hub-psi.vercel.app](https://ai-study-hub-psi.vercel.app/)**

---

## ✨ Features

| Feature | Description |
|---|---|
| 📝 **Notes Maker** | Upload a PDF/DOCX and get Summary, Detailed, Exam-Focused, or Flashcard notes |
| ❓ **Q&A Assistant** | Ask questions about your study material — answers grounded strictly in your doc |
| 🃏 **Flashcard Game** | Auto-generate interactive Q&A flashcards from any file or topic |
| 📊 **MCQ Generator** | Generate multiple-choice questions from your notes or a topic |
| ✍️ **Subjective Practice** | Get open-ended exam questions with model answers |
| 🎨 **Theory to Visual** | Convert any concept into Flowcharts, Mind Maps, Timelines, Cycle Diagrams, Hierarchies, and Comparisons |
| 🤖 **AI Tutor** | Chat with an AI tutor about any subject |
| 📅 **Study Planner** | Create AI-generated study plans with daily schedules |

---

## 🔧 PDF Extraction Pipeline

Handles both digital and scanned PDFs automatically — no manual pasting needed.

```
PDF uploaded
    │
    ▼
[1] pdfjs text layer      ← fast, works on digital PDFs
    │ (low quality?)
    ▼
[2] Vision AI (OpenRouter) ← free vision models, handles scanned PDFs
    │ (unavailable?)
    ▼
[3] Tesseract.js OCR      ← fully offline browser OCR, final fallback
    │ (all fail?)
    ▼
User prompted to paste manually
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Free API keys (see below)

### Installation

```bash
git clone https://github.com/sakshii1411/ai-study-hub.git
cd ai-study-hub
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_GROQ_API_KEY=your_groq_key
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_NVIDIA_API_KEY=your_nvidia_key
```

Get free keys:
- **Groq** (fastest) → https://console.groq.com
- **OpenRouter** (Vision AI + fallback models) → https://openrouter.ai
- **NVIDIA NIM** (fallback) → https://build.nvidia.com

### Run Locally

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

---

## 🛠️ Tech Stack

- **Frontend** — React 18 + TypeScript + Vite
- **Styling** — Tailwind CSS + shadcn/ui
- **AI** — Groq (Llama 3.3 70B) → OpenRouter → NVIDIA NIM
- **PDF Parsing** — pdfjs-dist + Vision AI + Tesseract.js OCR
- **Diagrams** — Custom SVG engine with dynamic layouts
- **Routing** — React Router v6
- **Deployment** — Vercel

---

## 📁 Project Structure

```
src/
├── components/
│   ├── PDFUploader.tsx      # Drag-and-drop uploader with OCR progress
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── aiClient.ts          # Multi-provider AI with fallback chain
│   └── extractFileText.ts   # 3-stage PDF extraction pipeline
└── pages/
    ├── NotesMaker.tsx
    ├── QnAComponent.tsx
    ├── FlashCardPage.tsx
    ├── MCQPage.tsx
    ├── SubjectivePage.tsx
    ├── ImageGenerator.tsx   # Theory to Visual diagrams
    ├── AITutorPage.tsx
    └── Dashboard.tsx
```

---

## 📦 Deploying to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sakshii1411/ai-study-hub)

1. Click the button above
2. Add your environment variables
3. Deploy ✅

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT © [Sakshi Awasthi](https://github.com/sakshii1411)
