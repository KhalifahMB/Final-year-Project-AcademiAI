import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import StatTile from '@/components/shared/StatTile';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import {
 BrainCircuit,
 CheckCircle2,
 ChevronRight,
 Clock,
 ClipboardList,
 Loader2,
 Sparkles,
 Trophy,
} from 'lucide-react';

const STATUSES = ['all', 'published', 'draft', 'archived'];

export default function QuizzesPage() {
 const qc = useQueryClient();
 const { user } = useAuth();
 const isStaff = user?.role === 'lecturer' || user?.role === 'tenant_admin' || user?.is_superuser;
 const [pollJob, setPollJob] = useState(null);
 const [statusFilter, setStatusFilter] = useState('all');

 const { data, isLoading, error } = useQuery({
 queryKey: ['quizzes'],
 queryFn: async () => {
 const { data } = await api.get('/quizzes/?page_size=50');
 return data.results || data;
 },
 });

 useQuery({
 queryKey: ['quiz-job', pollJob],
 queryFn: async () => {
 const { data: job } = await api.get(`/jobs/${pollJob}/`);
 if (job.ready) {
 setPollJob(null);
 if (job.successful && job.result?.quiz_id) toast.success('Quiz generated!');
 else toast.error(job.error || job.result?.error || 'Generation failed');
 qc.invalidateQueries({ queryKey: ['quizzes'] });
 }
 return job;
 },
 enabled: !!pollJob,
 refetchInterval: 2500,
 });

 const gen = useMutation({
 mutationFn: () =>
 api.post('/quizzes/generate/', { num_questions: 5, title: 'Practice quiz' }),
 onSuccess: (res) => {
 toast.success('Generation queued — this takes a moment');
 setPollJob(res.data.job_id);
 },
 onError: (err) =>
 toast.error(err.response?.data?.error?.detail || 'Generate failed'),
 });

 const quizzes = (data || []).filter(
 (q) => statusFilter === 'all' || q.status === statusFilter,
 );
 const generating = gen.isPending || !!pollJob;

 const counts = (data || []).reduce(
 (acc, q) => {
 acc[q.status] = (acc[q.status] || 0) + 1;
 return acc;
 },
 { all: data?.length || 0, published: 0, draft: 0, archived: 0 },
 );

 return (
 <AppShell
 title="Quizzes"
 description="Practice assessments — generate one from your authorized materials or take a published quiz."
 actions={
 isStaff ? (
 <Button size="sm" asChild className="h-8 gap-1.5 px-3 text-xs">
 <Link to="/admin/quizzes">
 <ClipboardList className="h-3.5 w-3.5" aria-hidden />
 Manage quizzes
 </Link>
 </Button>
 ) : (
  <Button
  type="button"
  size="sm"
  onClick={() => gen.mutate()}
  disabled={generating}
  className="h-8 gap-1.5 bg-[var(--accent)] px-3 text-xs text-[var(--on-accent)] hover:bg-[var(--accent-strong)]"
  >
 {generating ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 ) : (
 <Sparkles className="h-3.5 w-3.5" aria-hidden />
 )}
 {generating ? 'Generating…' : 'Generate with AI'}
 </Button>
 )
 }
 >
 {/* AI generation banner (students only while generating) */}
  {generating && !isStaff && (
  <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-[var(--accent-soft)] p-3.5">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)]">
 <BrainCircuit className="h-4 w-4" aria-hidden />
 </span>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium">Creating a practice quiz from your materials…</p>
 <p className="text-[11px] text-muted-foreground">Questions are being grounded in your authorized resources. This usually takes 10–20 seconds.</p>
 </div>
 <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
 </div>
 )}

  {error ? (
  <Alert variant="destructive" role="alert" className="mb-4">
  <AlertDescription className="text-xs">Failed to load quizzes{error?.response?.data?.detail ? `: ${error.response.data.detail}` : ''}</AlertDescription>
  </Alert>
  ) : null}

 {/* Stats strip */}
 {!isLoading && (data || []).length > 0 && (
 <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
 <StatTile label="Total" value={counts.all} icon={ClipboardList} tone="indigo" />
 <StatTile label="Published" value={counts.published || 0} icon={CheckCircle2} tone="emerald" />
 <StatTile label="Drafts" value={counts.draft || 0} icon={Clock} tone="amber" />
 <StatTile label="Your best" value={Math.max(0, ...(data || []).map((q) => q.best_score || 0))} suffix="%" icon={Trophy} tone="violet" />
 </div>
 )}

  {/* Filter chips */}
  {!isLoading && (data || []).length > 0 && (
  <div className="mb-3 flex flex-wrap items-center gap-1" role="group" aria-label="Filter quizzes by status">
  {STATUSES.map((s) => (
  <button
  key={s}
  type="button"
  onClick={() => setStatusFilter(s)}
  aria-pressed={statusFilter === s}
  className={cn(
 'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium capitalize transition-colors',
 statusFilter === s
 ? 'bg-primary/10 text-primary'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground',
 )}
 >
 {s}
 {s !== 'all' && (
 <span className={cn(
 'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]',
 statusFilter === s ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
 )}>
 {counts[s] || 0}
 </span>
 )}
 </button>
 ))}
 </div>
 )}

 {isLoading ? (
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {Array.from({ length: 6 }).map((_, i) => (
 <div
 key={i}
 className="skeleton h-[140px] rounded-xl"
 style={{ animationDelay: `${i * 70}ms` }}
 />
 ))}
 </div>
 ) : quizzes.length === 0 ? (
 <EmptyState
 icon={ClipboardList}
 title={statusFilter !== 'all' ? 'No quizzes in this filter' : 'No quizzes yet'}
 description={
 statusFilter !== 'all'
 ? 'Try a different status filter.'
 : isStaff
 ? 'Create a quiz from the manager or generate one with AI.'
 : 'Generate a practice quiz with AI, or wait for your lecturer to publish one.'
 }
  action={
  !isStaff && statusFilter === 'all' ? 'Generate practice quiz' : undefined
  }
  onAction={
  !isStaff && statusFilter === 'all' ? () => gen.mutate() : undefined
  }
  />
 ) : (
 <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {quizzes.map((q) => (
 <QuizCard
 key={q.id}
 q={q}
 isStaff={isStaff}
 />
 ))}
 </ul>
 )}
  </AppShell>
  );
}

function QuizCard({ q, isStaff }) {
 const hasAttempts = typeof q.attempt_count === 'number' && q.attempt_count > 0;
 const isPublished = q.status === 'published';
 const qCount = q.questions?.length || 0;
 return (
 <li>
 <article
 className={cn(
 'group flex h-full flex-col rounded-xl border bg-card p-4 transition-all',
 isPublished && 'transition-colors hover:border-[var(--border-strong)]',
 )}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex min-w-0 flex-1 items-start gap-2.5">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
 <BrainCircuit className="h-[18px] w-[18px]" aria-hidden />
 </span>
 <div className="min-w-0 flex-1">
 <h2 className="truncate text-sm font-semibold leading-snug" title={q.title}>
 {q.title}
 </h2>
 {q.description ? (
 <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
 {q.description}
 </p>
 ) : null}
 </div>
 </div>
 <StatusBadge status={q.status} />
 </div>

 <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
 <span className="inline-flex items-center gap-1">
 <Clock className="h-3 w-3" aria-hidden />
 {qCount ? `${qCount} question${qCount === 1 ? '' : 's'}` : 'No questions yet'}
 </span>
 {!isStaff && typeof q.best_score === 'number' && q.best_score > 0 && (
 <span className="inline-flex items-center gap-1 font-medium text-[var(--warn)]">
 <Trophy className="h-3 w-3" /> Best {q.best_score}%
 </span>
 )}
 {!isStaff && q.last_attempt_at && (
 <span className="text-[10.5px]">Last {formatRelativeTime(q.last_attempt_at)}</span>
 )}
 </div>

 <div className="mt-auto flex items-center justify-between pt-3.5">
 {isStaff ? (
 <Link
 to="/admin/quizzes"
 className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-accent"
 >
 Manage
 <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
 </Link>
 ) : isPublished ? (
 <Link
 to={`/quizzes/${q.id}/take`}
 className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
 >
 {hasAttempts ? 'Retake quiz' : 'Take quiz'}
 <ChevronRight className="h-3 w-3" aria-hidden />
 </Link>
 ) : (
 <span className="text-[11px] text-muted-foreground">Not yet published</span>
 )}
 {hasAttempts && !isStaff && typeof q.best_score === 'number' && (
 <span className="text-[10px] text-muted-foreground">{q.attempt_count} attempt{q.attempt_count === 1 ? '' : 's'}</span>
 )}
 </div>
 </article>
 </li>
 );
}
