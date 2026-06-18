import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, CalendarDays, Loader2, Sparkles } from "lucide-react";
import { callAIJson } from "@/lib/aiClient";

interface MarkingSchemeItem { questionType: string; count: number; marksPerQuestion: number; }
interface DayPlan { day: number; date: string; topics: string[]; tasks: string[]; hoursNeeded: number; }
interface StudySchedule { overview: string; dailyPlans: DayPlan[]; tips: string[]; }

const CreatePlan = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [examType, setExamType] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(2);
  const [syllabus, setSyllabus] = useState("");
  const [schedule, setSchedule] = useState<StudySchedule | null>(null);
  const [markingScheme, setMarkingScheme] = useState<MarkingSchemeItem[]>([
    { questionType: "", count: 1, marksPerQuestion: 0 },
  ]);

  const handleAddQuestionType = () => setMarkingScheme([...markingScheme, { questionType: "", count: 1, marksPerQuestion: 0 }]);

  const handleRemoveQuestionType = (index: number) => {
    if (markingScheme.length > 1) setMarkingScheme(markingScheme.filter((_, i) => i !== index));
    else toast.error("You must have at least one question type");
  };

  const handleMarkingSchemeChange = (index: number, field: keyof MarkingSchemeItem, value: string | number) => {
    const newScheme = [...markingScheme];
    newScheme[index] = { ...newScheme[index], [field]: value };
    setMarkingScheme(newScheme);
  };

  const handleGenerateSchedule = async () => {
    if (!subjectName || !examDate) { toast.error("Please fill in subject name and exam date first."); return; }
    setIsGeneratingSchedule(true);
    try {
      const daysUntilExam = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000));
      const prompt = `Create a detailed ${daysUntilExam}-day study schedule for:
Subject: ${subjectName}
Exam type: ${examType || "General exam"}
Days until exam: ${daysUntilExam}
Daily study hours available: ${dailyHours}
Syllabus/topics: ${syllabus || "General topics for " + subjectName}

Return ONLY valid JSON (no markdown):
{
  "overview": "2-3 sentence overview of the study strategy",
  "dailyPlans": [
    { "day": 1, "date": "YYYY-MM-DD", "topics": ["Topic 1", "Topic 2"], "tasks": ["Task description"], "hoursNeeded": 2 }
  ],
  "tips": ["Study tip 1", "Study tip 2", "Study tip 3"]
}
Generate up to ${Math.min(daysUntilExam, 14)} days. Start dates from today.`;

      const data = await callAIJson<StudySchedule>(prompt);
      setSchedule(data);
      toast.success("Study schedule generated! 📅");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate schedule.");
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName || !examType) { toast.error("Please fill in all required fields"); return; }
    if (markingScheme.some(item => !item.questionType || item.count <= 0 || item.marksPerQuestion <= 0)) {
      toast.error("Please complete all marking scheme fields"); return;
    }
    setIsLoading(true);
    try {
      const newPlan = { id: Date.now().toString(), subjectName, examType, examDate, dailyHours, syllabus, markingScheme, schedule };
      const existingPlans = JSON.parse(localStorage.getItem("examPlans") || "[]");
      existingPlans.push(newPlan);
      localStorage.setItem("examPlans", JSON.stringify(existingPlans));
      toast.success("Exam plan created successfully!");
      navigate("/dashboard");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create exam plan");
    } finally { setIsLoading(false); }
  };

  const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
            <CalendarDays className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Create <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Exam Plan</span></h1>
            <p className="text-muted-foreground">Set up your exam details and get an AI-generated study schedule.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic details */}
          <Card className="shadow-[var(--shadow-elevated)] dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
              <CardDescription>Enter the basic information about your exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject Name *</label>
                  <Input placeholder="e.g., Mathematics, Physics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Exam Type *</label>
                  <Input placeholder="e.g., Midterm, Final, JEE" value={examType} onChange={(e) => setExamType(e.target.value)} required />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Exam Date</label>
                  <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                  {daysLeft !== null && (
                    <p className={`text-xs font-semibold ${daysLeft < 7 ? "text-red-500" : daysLeft < 14 ? "text-orange-500" : "text-green-600"}`}>
                      {daysLeft === 0 ? "Exam is today!" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} until exam`}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Daily Study Hours</label>
                  <Input type="number" min={1} max={12} value={dailyHours} onChange={(e) => setDailyHours(Math.max(1, Math.min(12, parseInt(e.target.value) || 2)))} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Syllabus / Topics (optional)</label>
                <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)}
                  placeholder="e.g., Chapters 1-5, Calculus, Thermodynamics, Organic Chemistry…"
                  className="w-full min-h-[80px] px-4 py-2.5 border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-background"
                  rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* AI Study Schedule */}
          <Card className="shadow-[var(--shadow-elevated)] dark:bg-gray-900 dark:border-gray-700 border-indigo-100 dark:border-indigo-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" /> AI Study Schedule</CardTitle>
                  <CardDescription>Let AI generate a day-by-day study plan based on your exam date.</CardDescription>
                </div>
                <Button type="button" onClick={handleGenerateSchedule} disabled={isGeneratingSchedule || !subjectName || !examDate}
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white shrink-0">
                  {isGeneratingSchedule ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</> : "✨ Generate"}
                </Button>
              </div>
            </CardHeader>
            {schedule && (
              <CardContent className="space-y-4">
                <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <p className="text-sm text-indigo-800 dark:text-indigo-200 font-medium">{schedule.overview}</p>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {schedule.dailyPlans?.map((day, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        D{day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{day.date} · {day.hoursNeeded}h</p>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {day.topics?.map((t, j) => <span key={j} className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">{t}</span>)}
                        </div>
                        {day.tasks?.map((task, j) => <p key={j} className="text-xs text-muted-foreground">• {task}</p>)}
                      </div>
                    </div>
                  ))}
                </div>
                {schedule.tips?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2">Study Tips</p>
                    {schedule.tips.map((tip, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300">💡 {tip}</p>)}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Marking scheme */}
          <Card className="shadow-[var(--shadow-elevated)] dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Marking Scheme *</CardTitle>
                  <CardDescription>Define the question types and their weightage.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddQuestionType}>
                  <Plus className="h-4 w-4 mr-2" /> Add Type
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {markingScheme.map((item, index) => (
                <Card key={index} className="border-2 dark:bg-gray-800 dark:border-gray-600">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3 flex justify-between items-center mb-2">
                        <h4 className="font-medium">Question Type {index + 1}</h4>
                        {markingScheme.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveQuestionType(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <Input placeholder="e.g., MCQ, Short Answer" value={item.questionType} onChange={(e) => handleMarkingSchemeChange(index, "questionType", e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Count</label>
                        <Input type="number" min="1" value={item.count} onChange={(e) => handleMarkingSchemeChange(index, "count", parseInt(e.target.value))} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Marks Each</label>
                        <Input type="number" min="0" step="0.5" value={item.marksPerQuestion} onChange={(e) => handleMarkingSchemeChange(index, "marksPerQuestion", parseFloat(e.target.value))} required />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity" disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</> : "Create Exam Plan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreatePlan;
