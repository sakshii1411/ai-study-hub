import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ── Eager load only the Dashboard (first page users see) ────────────────────
import Dashboard from "./pages/Dashboard";

// ── Lazy load everything else — only downloaded when first visited ───────────
const NotesMaker      = lazy(() => import("./pages/NotesMaker"));
const QnAComponent    = lazy(() => import("./pages/QnAComponent"));
const TheoryMemorizer = lazy(() => import("./pages/TheoryMemorizer"));
const FlashCardPage   = lazy(() => import("./pages/FlashCardPage"));
const MCQPage         = lazy(() => import("./pages/MCQPage"));
const SubjectivePage  = lazy(() => import("./pages/SubjectivePage"));
const ImageGenerator  = lazy(() => import("./pages/ImageGenerator"));
const AITutorPage     = lazy(() => import("./pages/AITutorPage"));
const CreatePlan      = lazy(() => import("./pages/CreatePlan"));
const PlanDetail      = lazy(() => import("./pages/PlanDetail"));
const NotFound        = lazy(() => import("./pages/NotFound"));

// ── Minimal loading fallback — no layout shift ───────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-950">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min cache
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                element={<Dashboard />} />
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/notes-maker"     element={<NotesMaker />} />
              <Route path="/qna-component"   element={<QnAComponent />} />
              <Route path="/theory-memorizer" element={<TheoryMemorizer />} />
              <Route path="/flashcard"       element={<FlashCardPage />} />
              <Route path="/mcq"             element={<MCQPage />} />
              <Route path="/subjective"      element={<SubjectivePage />} />
              <Route path="/image-generator" element={<ImageGenerator />} />
              <Route path="/ai-tutor"        element={<AITutorPage />} />
              <Route path="/create-plan"     element={<CreatePlan />} />
              <Route path="/plan/:planId"    element={<PlanDetail />} />
              <Route path="*"               element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
