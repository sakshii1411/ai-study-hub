import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";

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

const queryClient = new QueryClient();

const PT = ({ children }: { children: React.ReactNode }) => (
  <PageTransition>{children}</PageTransition>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"               element={<PT><Dashboard /></PT>} />
        <Route path="/dashboard"      element={<PT><Dashboard /></PT>} />
        <Route path="/notes-maker"    element={<PT><NotesMaker /></PT>} />
        <Route path="/qna-component"  element={<PT><QnAComponent /></PT>} />
        <Route path="/theory-memorizer" element={<PT><TheoryMemorizer /></PT>} />
        <Route path="/flashcard"      element={<PT><FlashCardPage /></PT>} />
        <Route path="/mcq"            element={<PT><MCQPage /></PT>} />
        <Route path="/subjective"     element={<PT><SubjectivePage /></PT>} />
        <Route path="/image-generator" element={<PT><ImageGenerator /></PT>} />
        <Route path="/ai-tutor"       element={<PT><AITutorPage /></PT>} />
        <Route path="/create-plan"    element={<PT><CreatePlan /></PT>} />
        <Route path="/plan/:planId"   element={<PT><PlanDetail /></PT>} />
        <Route path="*"               element={<PT><NotFound /></PT>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
