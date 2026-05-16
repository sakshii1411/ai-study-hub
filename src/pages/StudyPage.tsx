// src/pages/StudyPage.tsx
import { useParams, useNavigate, Outlet, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Import the new icon: MessageSquare
import { ArrowLeft, BookOpen, Pencil, BrainCircuit, Image as ImageIcon, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";


const StudyPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine if a sub-route is active
  const isSubRouteActive = location.pathname !== `/plan/${planId}/study`;

  const studyOptions = [
    {
      title: "Notes Maker",
      description: "Create and organize notes",
      icon: Pencil,
      path: "notes-maker",
      color: "from-yellow-500 to-yellow-600",
    },
    {
      title: "Theory Memorizer",
      description: "Tools to memorize concepts",
      icon: BrainCircuit,
      path: "theory-memorizer",
      color: "from-teal-500 to-teal-600",
    },
    {
      title: "Image Generator",
      description: "Visualize theories with AI",
      icon: ImageIcon,
      path: "image-generator",
      color: "from-indigo-500 to-indigo-600",
    },
    {
      title: "QnA Component",
      description: "Ask and answer questions about the plan",
      icon: MessageSquare, // Using MessageSquare icon
      path: "qna-component", // Use a unique path slug
      color: "from-pink-500 to-pink-600", // New color for distinction
    },
    // ✨ NEW AI TUTOR OPTION
    {
      title: "AI Tutor",
      description: "Talk with a personal AI teacher",
      icon: MessageSquare, // Re-using icon, you can change it
      path: "ai-tutor",
      color: "from-red-500 to-red-600",
    },
    // ✨ END OF NEW OPTION
  ];


  return (
    // Match background from ImageGenerator for consistency
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      {/* Header */}
      {/* Make header sticky like in ImageGenerator */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        {/* Apply container and padding *inside* the header */}
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Point back button to Plan Details page */}
          <Button variant="ghost" onClick={() => navigate(`/plan/${planId}`)} className="text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plan Details
          </Button>
        </div>
      </header>

      {/* Main Content - REMOVE container, mx-auto, max-w-*. ADD padding. */}
      <main className="w-full px-4 lg:px-8 py-8">
        {/* Only show Study Options centered if no sub-route is active */}
        {!isSubRouteActive ? (
            // Add a container specifically for the options view
            <div className="container mx-auto max-w-4xl">
              <Card className="shadow-lg border-border/50"> {/* Use consistent styling */}
                <CardHeader>
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-3xl">Study Tools</CardTitle>
                  <CardDescription> {/* Use CardDescription */}
                    Choose a tool to start your study session.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    {studyOptions.map((option) => (
                      <Link key={option.path} to={option.path}>
                        {/* Use consistent card styling */}
                        <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/40 border-2 border-border/50 h-full">
                          <CardHeader>
                            <div className={cn(
                              "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                                option.color
                              )}>
                              <option.icon className="h-6 w-6 text-white" />
                            </div>
                            <CardTitle className="text-lg">{option.title}</CardTitle>
                            <CardDescription className="text-sm">{option.description}</CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
        ) : (
          // Render the active sub-route component (e.g., ImageGenerator) directly
          // It will now take up the full width allowed by the <main> tag above
            <Outlet />
        )}
      </main>
    </div>
  );
};

export default StudyPage;