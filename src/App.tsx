import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import all pages
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import CreatePlan from "./pages/CreatePlan";
import PlanDetail from "./pages/PlanDetail";
import NotesMaker from "./pages/NotesMaker";
import TheoryMemorizer from "./pages/TheoryMemorizer";
import ImageGenerator from "./pages/ImageGenerator";
import QnAComponent from "./pages/QnAComponent";
import AITutorPage from "./pages/AITutorPage";
import FlashCardPage from "./pages/FlashCardPage";
import MCQPage from "./pages/MCQPage";
import SubjectivePage from "./pages/SubjectivePage";
// The auth pages (Index, Login, SignUp) are no longer imported

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* --- Auth Routes Removed --- */}
          
          {/* Main App Routes */}
          <Route path="/" element={<Dashboard />} /> {/* Set Dashboard as the root */}
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Top-Level Tool Routes */}
          <Route path="/notes-maker" element={<NotesMaker />} />
          <Route path="/qna-component" element={<QnAComponent />} />
          <Route path="/theory-memorizer" element={<TheoryMemorizer />} />
          <Route path="/flashcard" element={<FlashCardPage />} />
          <Route path="/mcq" element={<MCQPage />} />
          <Route path="/subjective" element={<SubjectivePage />} />
          <Route path="/image-generator" element={<ImageGenerator />} />
          <Route path="/ai-tutor" element={<AITutorPage />} /> 

          {/* Plan-based routes (kept for now) */}
          <Route path="/create-plan" element={<CreatePlan />} />
          <Route path="/plan/:planId" element={<PlanDetail />} />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;