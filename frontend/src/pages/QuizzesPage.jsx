import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function QuizzesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data } = await api.get("/quizzes/");
      return data.results || data;
    },
  });
  const gen = useMutation({
    mutationFn: () => api.post("/quizzes/generate/", { num_questions: 5, title: "Practice quiz" }),
    onSuccess: (res) => {
      setMsg(`Job queued: ${res.data.job_id}`);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: () => setMsg("Generate failed (lecturer/admin only)"),
  });
  return (
    <AppShell title="Quizzes">
      {(user?.role === "lecturer" || user?.role === "admin") && (
        <div className="mb-4">
          <Button type="button" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? "Queuing…" : "Generate quiz (AI)"}
          </Button>
          {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
        </div>
      )}
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load quizzes</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((q) => (
            <Card key={q.id}><CardContent className="py-4 flex justify-between items-center">
              <span className="font-medium">{q.title}</span>
              <Badge variant="secondary">{q.status}</Badge>
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No quizzes yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
