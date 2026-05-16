import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

interface MarkingSchemeItem {
  questionType: string;
  count: number;
  marksPerQuestion: number;
}

const CreatePlan = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [examType, setExamType] = useState("");
  const [markingScheme, setMarkingScheme] = useState<MarkingSchemeItem[]>([
    { questionType: "", count: 1, marksPerQuestion: 0 },
  ]);

  const handleAddQuestionType = () => {
    setMarkingScheme([
      ...markingScheme,
      { questionType: "", count: 1, marksPerQuestion: 0 },
    ]);
  };

  const handleRemoveQuestionType = (index: number) => {
    if (markingScheme.length > 1) {
      const newScheme = markingScheme.filter((_, i) => i !== index);
      setMarkingScheme(newScheme);
    } else {
      toast.error("You must have at least one question type");
    }
  };

  const handleMarkingSchemeChange = (
    index: number,
    field: keyof MarkingSchemeItem,
    value: string | number
  ) => {
    const newScheme = [...markingScheme];
    newScheme[index] = {
      ...newScheme[index],
      [field]: value,
    };
    setMarkingScheme(newScheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectName || !examType) {
      toast.error("Please fill in all required fields");
      return;
    }

    const hasEmptyFields = markingScheme.some(
      (item) => !item.questionType || item.count <= 0 || item.marksPerQuestion <= 0
    );

    if (hasEmptyFields) {
      toast.error("Please complete all marking scheme fields");
      return;
    }

    setIsLoading(true);

    try {
      // Create plan with unique ID
      const newPlan = {
        id: Date.now().toString(),
        subjectName,
        examType,
        markingScheme,
      };

      // Get existing plans from localStorage
      const existingPlans = JSON.parse(localStorage.getItem("examPlans") || "[]");
      existingPlans.push(newPlan);
      localStorage.setItem("examPlans", JSON.stringify(existingPlans));

      toast.success("Exam plan created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to create exam plan");
    } finally {
      setIsLoading(false);
    }
  };

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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Create <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Exam Plan</span>
          </h1>
          <p className="text-muted-foreground">
            Set up your exam details and marking scheme
          </p>
        </div>

        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader>
            <CardTitle>Exam Details</CardTitle>
            <CardDescription>
              Enter the basic information about your exam
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="subjectName" className="text-sm font-medium">
                  Subject Name *
                </label>
                <Input
                  id="subjectName"
                  placeholder="e.g., Mathematics, Physics, History"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="examType" className="text-sm font-medium">
                  Exam Type *
                </label>
                <Input
                  id="examType"
                  placeholder="e.g., Midterm, Final, Quiz"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-medium">Marking Scheme *</h3>
                    <p className="text-sm text-muted-foreground">
                      Define the question types and their weightage
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestionType}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                </div>

                {markingScheme.map((item, index) => (
                  <Card key={index} className="border-2">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3 flex justify-between items-center mb-2">
                          <h4 className="font-medium">Question Type {index + 1}</h4>
                          {markingScheme.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveQuestionType(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Type</label>
                          <Input
                            placeholder="e.g., MCQ, Short Answer"
                            value={item.questionType}
                            onChange={(e) =>
                              handleMarkingSchemeChange(index, "questionType", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Count</label>
                          <Input
                            type="number"
                            min="1"
                            value={item.count}
                            onChange={(e) =>
                              handleMarkingSchemeChange(index, "count", parseInt(e.target.value))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Marks Each</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.marksPerQuestion}
                            onChange={(e) =>
                              handleMarkingSchemeChange(
                                index,
                                "marksPerQuestion",
                                parseFloat(e.target.value)
                              )
                            }
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Plan..." : "Create Exam Plan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreatePlan;
