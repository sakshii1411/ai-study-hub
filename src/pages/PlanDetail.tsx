import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Gamepad2, ListChecks, FileText } from "lucide-react";
import { toast } from "sonner";

interface ExamPlan {
  id: string;
  subjectName: string;
  examType: string;
  markingScheme: any[];
}

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ExamPlan | null>(null);

  useEffect(() => {
    // Removed user login check

    // Load the specific plan
    const plans = JSON.parse(localStorage.getItem("examPlans") || "[]");
    const foundPlan = plans.find((p: ExamPlan) => p.id === planId);

    if (!foundPlan) {
      toast.error("Plan not found");
      navigate("/dashboard");
      return;
    }

    setPlan(foundPlan);
  }, [planId, navigate]);

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const options = [
    {
      title: "Study",
      description: "Review materials and study resources",
      icon: BookOpen,
      path: `/plan/${planId}/study`,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Flash Card Game",
      description: "Test your knowledge with flashcards",
      icon: Gamepad2,
      path: `/plan/${planId}/flashcard`,
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "MCQ Question",
      description: "Practice multiple choice questions",
      icon: ListChecks,
      path: `/plan/${planId}/mcq`,
      color: "from-green-500 to-green-600",
    },
    {
      title: "Subjective Questions",
      description: "Answer detailed questions",
      icon: FileText,
      path: `/plan/${planId}/subjective`,
      color: "from-orange-500 to-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Plan Info Card */}
        <Card className="shadow-[var(--shadow-elevated)] mb-8 border-2 border-primary/20">
          <CardHeader>
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl">{plan.subjectName}</CardTitle>
            <CardDescription className="text-lg">{plan.examType}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Marking Scheme:</h3>
              <div className="grid gap-2">
                {plan.markingScheme.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="font-medium">{item.questionType}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.count} questions × {item.marksPerQuestion} marks
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Study Options</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {options.map((option) => (
              <Link key={option.path} to={option.path}>
                <Card className="cursor-pointer transition-all hover:shadow-[var(--shadow-elevated)] hover:scale-105 border-2 h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${option.color} flex items-center justify-center mb-4`}>
                      <option.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle>{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlanDetail;
