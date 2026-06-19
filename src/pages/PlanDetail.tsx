import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Gamepad2, ListChecks, FileText, CalendarDays, Clock, ChevronDown, ChevronUp, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MarkingSchemeItem { questionType: string; count: number; marksPerQuestion: number; }
interface DayPlan { day: number; date: string; topics: string[]; tasks: string[]; hoursNeeded: number; }
interface StudySchedule { overview: string; dailyPlans: DayPlan[]; tips: string[]; }
interface ExamPlan {
  id: string;
  subjectName: string;
  examType: string;
  examDate?: string;
  dailyHours?: number;
  syllabus?: string;
  markingScheme: MarkingSchemeItem[];
  schedule?: StudySchedule;
}

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ExamPlan | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    const plans = JSON.parse(localStorage.getItem("examPlans") || "[]");
    const found = plans.find((p: ExamPlan) => p.id === planId);
    if (!found) { toast.error("Plan not found"); navigate("/dashboard"); return; }
    setPlan(found);
  }, [planId, navigate]);

  const deletePlan = () => {
    const plans = JSON.parse(localStorage.getItem("examPlans") || "[]");
    localStorage.setItem("examPlans", JSON.stringify(plans.filter((p: ExamPlan) => p.id !== planId)));
    toast.success("Plan deleted.");
    navigate("/dashboard");
  };

  if (!plan) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-950"><p className="dark:text-white">Loading…</p></div>;

  const daysLeft = plan.examDate
    ? Math.max(0, Math.ceil((new Date(plan.examDate).getTime() - Date.now()) / 86400000))
    : null;

  const tools = [
    { title: "Flash Cards", description: "Spaced repetition flashcards", icon: Gamepad2, path: "/flashcard", color: "from-purple-500 to-purple-600" },
    { title: "MCQ Quiz", description: "Multiple choice practice", icon: ListChecks, path: "/mcq", color: "from-green-500 to-green-600" },
    { title: "Subjective Practice", description: "Written answers with AI evaluation", icon: FileText, path: "/subjective", color: "from-orange-500 to-orange-600" },
    { title: "Notes Maker", description: "Generate structured study notes", icon: BookOpen, path: "/notes-maker", color: "from-blue-500 to-blue-600" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background dark:from-gray-950 dark:via-gray-900 dark:to-background">
      <header className="border-b dark:border-gray-800 bg-card/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button variant="ghost" size="sm" onClick={deletePlan} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
            <Trash2 className="h-4 w-4 mr-1" /> Delete Plan
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        {/* Plan header card */}
        <Card className="shadow-[var(--shadow-elevated)] border-2 border-primary/20 dark:bg-gray-900 dark:border-primary/30">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-md">
                  <CalendarDays className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-3xl dark:text-white">{plan.subjectName}</CardTitle>
                <CardDescription className="text-lg mt-1">{plan.examType}</CardDescription>
              </div>
              {daysLeft !== null && (
                <div className={`shrink-0 text-center px-4 py-3 rounded-2xl border-2 font-bold ${
                  daysLeft === 0 ? "bg-red-50 border-red-400 text-red-600 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
                  : daysLeft < 7 ? "bg-orange-50 border-orange-400 text-orange-600 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-400"
                  : "bg-green-50 border-green-400 text-green-600 dark:bg-green-950 dark:border-green-700 dark:text-green-400"
                }`}>
                  <p className="text-3xl font-black">{daysLeft}</p>
                  <p className="text-xs uppercase tracking-wider">{daysLeft === 1 ? "day" : "days"} left</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4">
              {plan.examDate && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                  <CalendarDays className="h-3.5 w-3.5" /> {new Date(plan.examDate).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}
                </span>
              )}
              {plan.dailyHours && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                  <Clock className="h-3.5 w-3.5" /> {plan.dailyHours}h/day
                </span>
              )}
            </div>

            {/* Marking scheme */}
            <h3 className="font-semibold text-base mb-2 dark:text-white">Marking Scheme</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {plan.markingScheme.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-muted/50 dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                  <span className="font-medium text-sm dark:text-white">{item.questionType}</span>
                  <span className="text-xs text-muted-foreground">{item.count}q × {item.marksPerQuestion}m = <b>{item.count * item.marksPerQuestion}</b></span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-right font-semibold">
              Total: {plan.markingScheme.reduce((s,i) => s + i.count * i.marksPerQuestion, 0)} marks
            </p>
          </CardContent>
        </Card>

        {/* AI Study Schedule */}
        {plan.schedule && (
          <Card className="shadow-md dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="pb-2">
              <button onClick={() => setScheduleOpen(o => !o)} className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Sparkles className="h-5 w-5 text-indigo-500" /> AI Study Schedule
                </CardTitle>
                {scheduleOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>
              {scheduleOpen && <p className="text-sm text-muted-foreground mt-1">{plan.schedule.overview}</p>}
            </CardHeader>
            {scheduleOpen && (
              <CardContent className="space-y-3">
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {plan.schedule.dailyPlans?.map((day, i) => {
                    const dayDate = day.date ? new Date(day.date) : null;
                    const isPast = dayDate ? dayDate < new Date() : false;
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-xl border transition-all ${
                        isPast ? "opacity-50 bg-muted/30 dark:bg-gray-800/30 border-border dark:border-gray-700"
                        : "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900"
                      }`}>
                        <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                          isPast ? "bg-gray-400 dark:bg-gray-600" : "bg-gradient-to-br from-indigo-500 to-blue-600"
                        }`}>
                          D{day.day}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">{day.date} · {day.hoursNeeded}h</p>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {day.topics?.map((t,j) => (
                              <span key={j} className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">{t}</span>
                            ))}
                          </div>
                          {day.tasks?.map((task,j) => <p key={j} className="text-xs text-muted-foreground">• {task}</p>)}
                        </div>
                        {isPast && <span className="text-xs text-muted-foreground self-center shrink-0">✓ Past</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Tips */}
                {plan.schedule.tips?.length > 0 && (
                  <>
                    <button onClick={() => setTipsOpen(o=>!o)}
                      className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 w-full">
                      {tipsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Study Tips ({plan.schedule.tips.length})
                    </button>
                    {tipsOpen && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-1">
                        {plan.schedule.tips.map((tip,i) => (
                          <p key={i} className="text-xs text-amber-800 dark:text-amber-300">💡 {tip}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Study Tools */}
        <div>
          <h2 className="text-xl font-bold mb-4 dark:text-white">Study Tools</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {tools.map((tool) => (
              <button key={tool.path} onClick={() => navigate(tool.path)}
                className="text-left bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-3 shadow-md`}>
                  <tool.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base mb-1">{tool.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{tool.description}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlanDetail;
