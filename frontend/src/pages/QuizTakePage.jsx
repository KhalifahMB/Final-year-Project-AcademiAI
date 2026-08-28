import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime, cn } from "@/lib/utils";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

export default function QuizTakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isStaff = user?.role === "lecturer" || user?.role === "admin" || user?.is_superuser;
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [result, setResult] = useState(null);

  const quiz = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => (await api.get(`/quizzes/${id}/`)).data,
    enabled: !!id,
  });

  // Past attempts (for the "retake" flow and history)
  const attempts = useQuery({
    queryKey: ["quiz-attempts-mine", id],
    queryFn: async () => {
      const { data } = await api.get("/quiz-attempts/", { params: { quiz: id, page_size: 20 } });
      return data.results || data || [];
    },
    enabled: !!id && !isStaff,
  });

  const questions = useQuery({
    queryKey: ["quiz-questions", id],
    queryFn: async () => {
      const { data } = await api.get("/quiz-questions/", { params: { quiz: id } });
      return data.results || data;
    },
    enabled: !!id,
  });

  // If the user has an unsubmitted attempt in flight, we could resume it,
  // but for simplicity always start a fresh one when they click Start.
  useEffect(() => {
    // Reset state when navigating to a different quiz.
    setAnswers({});
    setAttemptId(null);
    setResult(null);
  }, [id]);

  const start = useMutation({
    mutationFn: () => api.post("/quiz-attempts/", { quiz: id }),
    onSuccess: (res) => {
      setAttemptId(res.data.id);
      setAnswers({});
      setResult(null);
      toast.success("Attempt started");
      qc.invalidateQueries({ queryKey: ["quiz-attempts-mine", id] });
    },
    onError: (err) => {
      const detail = err.response?.data?.detail || "Could not start attempt";
      toast.error(detail);
    },
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/quiz-attempts/${attemptId}/submit/`, { answers }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success("Submitted");
      qc.invalidateQueries({ queryKey: ["quiz-attempts-mine", id] });
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (err) => {
      const d = err.response?.data?.error?.detail || err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Submit failed");
    },
  });

  const retake = () => {
    setResult(null);
    setAttemptId(null);
    setAnswers({});
    start.mutate();
  };

  const loadAttemptReview = async (attemptId) => {
    try {
      const { data } = await api.get(`/quiz-attempts/${attemptId}/`);
      setResult(data);
      setAttemptId(attemptId);
    } catch {
      toast.error("Could not load that attempt");
    }
  };

  const qs = questions.data || quiz.data?.questions || [];

  return (
    <AppShell title={quiz.data?.title || "Take quiz"} description={quiz.data?.description}>
      <Link to="/quizzes" className="text-sm text-primary hover:underline mb-4 inline-block">
        ← Quizzes
      </Link>

      {quiz.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Quiz not found</AlertDescription>
        </Alert>
      )}

      {quiz.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{quiz.data.status}</Badge>
          <span>· {qs.length} question{qs.length === 1 ? "" : "s"}</span>
          {typeof quiz.data.best_score === "number" && (
            <span>· Best: <strong className="text-foreground">{quiz.data.best_score}%</strong></span>
          )}
          {typeof quiz.data.attempt_count === "number" && quiz.data.attempt_count > 0 && (
            <span>· {quiz.data.attempt_count} attempt{quiz.data.attempt_count === 1 ? "" : "s"}</span>
          )}
        </div>
      )}

      {/* Past attempts list */}
      {!isStaff && attempts.data && attempts.data.length > 0 && !attemptId && !result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Past attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {attempts.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {a.submitted_at
                        ? `Score: ${a.score ?? "—"}%`
                        : "In progress…"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatRelativeTime(a.started_at)}
                      {a.submitted_at ? ` · submitted ${formatRelativeTime(a.submitted_at)}` : ""}
                    </p>
                  </div>
                  {a.submitted_at ? (
                    <Button size="sm" variant="outline" onClick={() => loadAttemptReview(a.id)}>
                      Review
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setAttemptId(a.id)}>
                      Resume
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isStaff && !result && (
        <Alert className="mb-4">
          <AlertDescription>
            Staff accounts author quizzes but do not sit them. Manage questions
            from the Quiz manager.
          </AlertDescription>
        </Alert>
      )}

      {!attemptId && !result && !isStaff && (
        <Button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? "Starting…" : attempts.data?.length ? "Retake quiz" : "Start attempt"}
        </Button>
      )}

      {!isStaff && attemptId && !result && (
        <div className="space-y-4 max-w-2xl">
          {qs.map((q, idx) => {
            const options = q.options || [];
            return (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {idx + 1}. {q.question_text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {options.length > 0 ? (
                    options.map((opt, i) => {
                      const val = typeof opt === "string" ? opt : opt.text || opt.id || String(opt);
                      return (
                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={i}
                            checked={answers[q.id] === i || answers[q.id] === val}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                          />
                          {val}
                        </label>
                      );
                    })
                  ) : (
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Your answer"
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
          {qs.length === 0 && (
            <p className="text-sm text-muted-foreground">No questions on this quiz yet.</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || qs.length === 0}
            >
              {submit.isPending ? "Submitting…" : "Submit answers"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setAttemptId(null); setAnswers({}); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="card-surface-hover sm:col-span-2 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-5">
                  <div
                    className={cn(
                      "flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-bold shadow-inner",
                      (result.score ?? 0) >= 70
                        ? "bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/15 dark:text-emerald-400"
                        : (result.score ?? 0) >= 40
                        ? "bg-amber-500/10 text-amber-600 ring-4 ring-amber-500/15 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-600 ring-4 ring-rose-500/15 dark:text-rose-400"
                    )}
                  >
                    {result.score ?? "—"}%
                  </div>
                  <div className="space-y-1 text-sm">
                    {typeof result.correct_count === "number" && typeof result.total_questions === "number" && (
                      <p className="font-medium">
                        {result.correct_count} of {result.total_questions} correct
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      Submitted{" "}
                      <span title={result.submitted_at} className="text-foreground">
                        {result.submitted_at ? formatRelativeTime(result.submitted_at) : "—"}
                      </span>
                    </p>
                    <div className="flex gap-2 pt-2">
                      {!isStaff && (
                        <Button type="button" onClick={retake} size="sm">
                          <RotateCcw className="mr-2 h-4 w-4" /> Retake quiz
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate("/quizzes")}>
                        Back to quizzes
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Review each question */}
          {Array.isArray(result.review) && result.review.length > 0 && (
            <div className="space-y-3 max-w-3xl">
              <h3 className="text-base font-semibold">Review your answers</h3>
              {result.review.map((r, i) => {
                const correctIdx = r.correct_answer?.index;
                const correctValue =
                  typeof correctIdx === "number" && Array.isArray(r.options)
                    ? r.options[correctIdx]
                    : r.correct_answer?.value;
                const userIdx = typeof r.user_answer === "number" ? r.user_answer : null;
                const userValue =
                  userIdx !== null && Array.isArray(r.options)
                    ? r.options[userIdx]
                    : r.user_answer;
                return (
                  <Card key={r.question_id} className={cn(
                    "shadow-card card-surface-hover border-l-4 overflow-hidden",
                    r.is_correct ? "border-l-emerald-500" : "border-l-rose-500",
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-start gap-2 text-base">
                        {r.is_correct ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                        )}
                        <span>{i + 1}. {r.question_text}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {Array.isArray(r.options) && r.options.length > 0 ? (
                        <ul className="space-y-1.5">
                          {r.options.map((opt, oi) => {
                            const isUser = oi === userIdx;
                            const isCorrect = oi === correctIdx;
                            return (
                              <li
                                key={oi}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                                  isCorrect && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                                  isUser && !isCorrect && "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300",
                                  !isUser && !isCorrect && "text-muted-foreground",
                                )}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-mono">
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="flex-1">{typeof opt === "string" ? opt : opt.text || String(opt)}</span>
                                {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                                {isUser && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="space-y-1">
                          <p><span className="text-muted-foreground">Your answer:</span> {String(userValue ?? "—")}</p>
                          <p><span className="text-muted-foreground">Correct answer:</span> {String(correctValue ?? "—")}</p>
                        </div>
                      )}
                      {r.explanation && (
                        <p className="rounded-lg bg-muted/50 p-2.5 text-xs italic text-muted-foreground">
                          <span className="not-italic font-semibold text-foreground">Explanation: </span>
                          {r.explanation}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
