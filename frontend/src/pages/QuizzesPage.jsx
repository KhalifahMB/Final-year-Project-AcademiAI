import { dashApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ClipboardList, Sparkles } from "lucide-react";

export default function QuizzesPage() {
  const qc = useQueryClient();
  const [pollJob, setPollJob] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data } = await dashApi.quizzes();
      return data.results || data;
    },
  });

  // While a generation job runs, poll its status; refresh on completion.
  useQuery({
    queryKey: ["quiz-job", pollJob],
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${pollJob}/`);
      if (data.ready) {
        setPollJob(null);
        if (data.successful && data.result?.quiz_id) {
          toast.success("Quiz generated!");
        } else {
          toast.error(data.error || data.result?.error || "Generation failed");
        }
        qc.invalidateQueries({ queryKey: ["quizzes"] });
      }
      return data;
    },
    enabled: !!pollJob,
    refetchInterval: 2500,
  });

  const gen = useMutation({
    mutationFn: () =>
      api.post("/quizzes/generate/", { num_questions: 5, title: "Practice quiz" }),
    onSuccess: (res) => {
      toast.success("Generation queued — this takes a moment");
      setPollJob(res.data.job_id);
    },
    onError: (err) =>
      toast.error(err.response?.data?.error?.detail || "Generate failed"),
  });

  const quizzes = data || [];
  const generating = gen.isPending || !!pollJob;

  return (
    <AppShell
      title="Quizzes"
      description="Practice assessments — generate one from your authorized materials or take a published quiz."
      actions={
        <Button
          type="button"
          onClick={() => gen.mutate()}
          disabled={generating}
          className="shadow-sm"
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          {generating ? "Generating…" : "Generate with AI"}
        </Button>
      }
    >
      {generating ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" aria-hidden />
          Creating a practice quiz from your materials — the list refreshes
          automatically when it's ready.
        </div>
      ) : null}

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
          description="Generate a practice quiz with AI from your authorized course materials, or wait for your lecturer to publish one."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((q) => (
            <li key={q.id}>
              <article className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug" title={q.title}>
                    {q.title}
                  </h2>
                  <StatusBadge status={q.status} />
                </div>
                {q.description ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {q.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {q.questions?.length
                    ? `${q.questions.length} question${q.questions.length === 1 ? "" : "s"}`
                    : "No questions yet"}
                </p>
                <div className="mt-auto pt-3.5">
                  <Link
                    to={`/quizzes/${q.id}/take`}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Take quiz
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
