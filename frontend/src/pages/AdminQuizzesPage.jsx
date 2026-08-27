import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { quizSchema, quizQuestionSchema } from "@/lib/validations";
import { ClipboardList, ClipboardPlus, ListPlus, Sparkles } from "lucide-react";

const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"];

function toList(res) {
  const d = res.data;
  return Array.isArray(d) ? d : d?.results || [];
}

export default function AdminQuizzesPage() {
  const qc = useQueryClient();
  const [quizDialog, setQuizDialog] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [questionsFor, setQuestionsFor] = useState(null);
  const [error, setError] = useState("");

  const quizzes = useQuery({
    queryKey: ["admin-quizzes"],
    queryFn: async () => toList(await api.get("/quizzes/")),
  });

  const offerings = useQuery({
    queryKey: ["opts", "/course-offerings/"],
    queryFn: async () => toList(await api.get("/course-offerings/")),
  });

  const quizForm = useForm({
    resolver: zodResolver(quizSchema),
    defaultValues: { title: "", description: "", status: "draft", course_offering: "" },
  });

  const questionForm = useForm({
    resolver: zodResolver(quizQuestionSchema),
    defaultValues: {
      question_text: "",
      question_type: "multiple_choice",
      options: "",
      correct_answer: "",
      explanation: "",
    },
  });

  const watchedQuestionType = useWatch({ control: questionForm.control, name: "question_type" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-quizzes"] });
    qc.invalidateQueries({ queryKey: ["quizzes"] });
    qc.invalidateQueries({ queryKey: ["dash-quizzes"] });
  };

  const saveQuiz = useMutation({
    mutationFn: (payload) =>
      editingQuiz
        ? api.patch(`/quizzes/${editingQuiz.id}/`, payload)
        : api.post("/quizzes/", payload),
    onSuccess: () => {
      toast.success(editingQuiz ? "Quiz updated" : "Quiz created");
      setQuizDialog(false);
      setEditingQuiz(null);
      invalidate();
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || "Save failed");
      toast.error("Save failed");
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: (id) => api.delete(`/quizzes/${id}/`),
    onSuccess: () => {
      toast.success("Quiz deleted");
      invalidate();
    },
    onError: () => toast.error("Delete failed"),
  });

  const addQuestion = useMutation({
    mutationFn: ({ quizId, payload }) =>
      api.post("/quiz-questions/", { ...payload, quiz: quizId }),
    onSuccess: () => {
      toast.success("Question added");
      questionForm.reset();
      qc.invalidateQueries({ queryKey: ["quiz-questions", questionsFor?.id] });
      invalidate();
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || "Could not add the question");
      toast.error("Could not add the question");
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: (id) => api.delete(`/quiz-questions/${id}/`),
    onSuccess: () => {
      toast.success("Question removed");
      qc.invalidateQueries({ queryKey: ["quiz-questions", questionsFor?.id] });
      invalidate();
    },
    onError: () => toast.error("Could not remove the question"),
  });

  // Questions of the quiz currently being managed.
  const questions = useQuery({
    queryKey: ["quiz-questions", questionsFor?.id],
    queryFn: async () =>
      toList(await api.get("/quiz-questions/", { params: { quiz: questionsFor.id } })),
    enabled: !!questionsFor,
  });

  const openCreate = () => {
    setEditingQuiz(null);
    setError("");
    quizForm.reset({ title: "", description: "", status: "draft", course_offering: "" });
    setQuizDialog(true);
  };

  const openEdit = (q) => {
    setEditingQuiz(q);
    setError("");
    quizForm.reset({
      title: q.title || "",
      description: q.description || "",
      status: q.status || "draft",
      course_offering: q.course_offering || "",
    });
    setQuizDialog(true);
  };

  const submitQuiz = (values) => {
    setError("");
    const payload = { ...values };
    if (!payload.course_offering) delete payload.course_offering;
    saveQuiz.mutate(payload);
  };

  const submitQuestion = (values) => {
    setError("");
    let options = [];
    if (values.question_type === "multiple_choice") {
      options = (values.options || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length < 2) {
        setError("Provide at least two comma-separated options.");
        return;
      }
    } else if (values.question_type === "true_false") {
      options = ["True", "False"];
    }
    const correct = { value: values.correct_answer.trim() };
    if (
      values.question_type !== "short_answer" &&
      !options.some(
        (o) => o.toLowerCase() === String(correct.value).toLowerCase(),
      )
    ) {
      setError("The correct answer must exactly match one of the options.");
      return;
    }
    addQuestion.mutate({
      quizId: questionsFor.id,
      payload: {
        question_text: values.question_text,
        question_type: values.question_type,
        options,
        correct_answer: correct,
        explanation: values.explanation || "",
      },
    });
  };

  return (
    <AppShell
      title="Quiz manager"
      description="Author practice assessments manually or alongside AI generation — publish them when they are ready for students."
      actions={
        <Button type="button" onClick={openCreate} className="h-9 shadow-sm">
          <ClipboardPlus className="mr-2 h-4 w-4" aria-hidden /> New quiz
        </Button>
      }
    >
      {/* Create / edit quiz dialog */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Edit quiz" : "New quiz"}</DialogTitle>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}
          <Form {...quizForm}>
            <form onSubmit={quizForm.handleSubmit(submitQuiz)} className="space-y-4">
              <FormField
                control={quizForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quizForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quizForm.control}
                name="course_offering"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course offering (optional)</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(offerings.data || []).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.course_code ? `${o.course_code} — ${o.course_title}` : o.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quizForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["draft", "published", "archived"].map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={saveQuiz.isPending} className="shadow-sm">
                  {saveQuiz.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Questions manager dialog */}
      <Dialog open={!!questionsFor} onOpenChange={(o) => !o && setQuestionsFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questions — {questionsFor?.title}</DialogTitle>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {(questions.data || []).map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{q.question_text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {q.question_type.replace("_", " ")} ·{" "}
                    {(q.options || []).length} option(s)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteQuestion.mutate(q.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {questions.isSuccess && (questions.data || []).length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                No questions yet — add the first one below.
              </p>
            )}
            {questions.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ListPlus className="h-3.5 w-3.5" aria-hidden /> Add a question
            </p>
            <Form {...questionForm}>
              <form
                onSubmit={questionForm.handleSubmit(submitQuestion)}
                className="space-y-3"
              >
                <FormField
                  control={questionForm.control}
                  name="question_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question</FormLabel>
                      <FormControl><Textarea rows={2} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={questionForm.control}
                    name="question_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full capitalize">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {QUESTION_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">
                                {t.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={questionForm.control}
                    name="correct_answer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correct answer</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Exact option text" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {watchedQuestionType === "multiple_choice" && (
                  <FormField
                    control={questionForm.control}
                    name="options"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Options (comma-separated)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Photosynthesis, Respiration, Osmosis" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={questionForm.control}
                  name="explanation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Explanation (optional)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={addQuestion.isPending} className="shadow-sm">
                  {addQuestion.isPending ? "Adding…" : "Add question"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {quizzes.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load quizzes</AlertDescription>
        </Alert>
      )}

      {quizzes.isLoading ? (
        <div className="space-y-2.5" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-muted"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : (quizzes.data || []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No quizzes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one manually or generate practice sets with AI from the Quizzes page.
          </p>
          <Sparkles className="mx-auto mt-2 h-4 w-4 text-primary" aria-hidden />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead className="w-[230px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(quizzes.data || []).map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="py-3.5 font-medium">{q.title}</TableCell>
                  <TableCell><StatusBadge status={q.status} /></TableCell>
                  <TableCell>{q.questions?.length ?? 0}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => setQuestionsFor(q)}>
                      Questions
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(q)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`Delete “${q.title}”? This cannot be undone.`))
                          deleteQuiz.mutate(q.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
