import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function QuizzesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data } = await api.get("/quizzes/");
      return data.results || data;
    },
  });

  const gen = useMutation({
    mutationFn: () =>
      api.post("/quizzes/generate/", { num_questions: 5, title: "Practice quiz" }),
    onSuccess: (res) => {
      toast.success(`Quiz job queued: ${res.data.job_id}`);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: () => toast.error("Generate failed (lecturer/admin only)"),
  });

  return (
    <AppShell title="Quizzes">
      {(user?.role === "lecturer" || user?.role === "admin") && (
        <div className="mb-4">
          <Button type="button" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? "Queuing…" : "Generate quiz (AI)"}
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load quizzes</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{q.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link to={`/quizzes/${q.id}/take`} className="text-sm text-primary hover:underline">
                      Take quiz
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {(data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No quizzes yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
