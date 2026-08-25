import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function QuizTakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === "lecturer" || user?.role === "admin";
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [result, setResult] = useState(null);

  const quiz = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => (await api.get(`/quizzes/${id}/`)).data,
    enabled: !!id,
  });

  const questions = useQuery({
    queryKey: ["quiz-questions", id],
    queryFn: async () => {
      const { data } = await api.get("/quiz-questions/", { params: { quiz: id } });
      return data.results || data;
    },
    enabled: !!id,
  });

  const start = useMutation({
    mutationFn: () => api.post("/quiz-attempts/", { quiz: id }),
    onSuccess: (res) => {
      setAttemptId(res.data.id);
      toast.success("Attempt started");
    },
    onError: () => toast.error("Could not start attempt"),
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/quiz-attempts/${attemptId}/submit/`, { answers }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success("Submitted");
    },
    onError: (err) => {
      const d =
        err.response?.data?.error?.detail || err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Submit failed");
    },
  });

  const qs = questions.data || quiz.data?.questions || [];

  return (
    <AppShell title={quiz.data?.title || "Take quiz"}>
      <Link to="/quizzes" className="text-sm text-primary hover:underline mb-4 inline-block">
        ← Quizzes
      </Link>
      {quiz.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Quiz not found</AlertDescription>
        </Alert>
      )}
      {quiz.data && (
        <p className="text-sm text-muted-foreground mb-4">
          Status: <Badge variant="secondary">{quiz.data.status}</Badge>
          {quiz.data.description ? ` — ${quiz.data.description}` : ""}
        </p>
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
          {start.isPending ? "Starting…" : "Start attempt"}
        </Button>
      )}

      {!isStaff && attemptId && !result && (
        <div className="space-y-4 max-w-2xl">
          {qs.map((q, idx) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {idx + 1}. {q.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(q.options || []).length > 0 ? (
                  (q.options || []).map((opt, i) => {
                    const val = typeof opt === "string" ? opt : opt.text || opt.id || String(opt);
                    return (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={val}
                          checked={answers[q.id] === val}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: val }))}
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
          ))}
          {qs.length === 0 && (
            <p className="text-sm text-muted-foreground">No questions on this quiz yet.</p>
          )}
          <Button
            type="button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || qs.length === 0}
          >
            {submit.isPending ? "Submitting…" : "Submit answers"}
          </Button>
        </div>
      )}

      {result && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              Score: <strong>{result.score ?? "—"}</strong>
            </div>
            <div>Submitted: {result.submitted_at || "—"}</div>
            <Button type="button" variant="outline" onClick={() => navigate("/quizzes")}>
              Back to quizzes
            </Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
