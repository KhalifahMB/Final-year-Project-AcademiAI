import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ClipboardList, Sparkles } from "lucide-react";

export default function QuizzesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isStaff = user?.role === "lecturer" || user?.role === "admin";

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
      toast.success(`Quiz job queued (${res.data.job_id.slice(0, 8)}…)`);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["quizzes"] }), 4000);
    },
    onError: () => toast.error("Generate failed (lecturer/admin only)"),
  });

  const quizzes = data || [];

  return (
    <AppShell
      title="Quizzes"
      description="Practice assessments — including AI-generated quizzes grounded in course materials."
      actions={
        isStaff ? (
          <Button
            type="button"
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="shadow-sm"
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            {gen.isPending ? "Queuing…" : "Generate with AI"}
          </Button>
        ) : null
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>Failed to load quizzes</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No quizzes yet"
          description={
            isStaff
              ? "Generate one with AI from authorized course content, or create one manually."
              : "Quizzes published for your courses will appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="py-3.5 pl-5 font-medium">{q.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Link
                      to={`/quizzes/${q.id}/take`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-[0.8rem] font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      Take quiz
                    </Link>
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
