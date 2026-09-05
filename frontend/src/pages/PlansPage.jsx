import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowRight, CalendarClock, CheckCircle2, LayoutTemplate, Loader2, Plus, Search, Target, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-[var(--info-soft)] text-[var(--info)]',
  completed: 'bg-[var(--success-soft)] text-[var(--success)]',
  paused: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  archived: 'bg-[var(--surface-2)] text-[var(--muted)]',
};

const TYPE_LABELS = {
  study: 'Study Plan',
  workflow: 'Workflow',
  personal: 'Personal',
};

export default function PlansPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateId, setTemplateId] = useState(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [newPlan, setNewPlan] = useState({ title: '', description: '', plan_type: 'study', start_date: '', target_date: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['plans', statusFilter],
    queryFn: () => plansApi.list({ status: statusFilter || undefined }),
  });

  const templatesQ = useQuery({
    queryKey: ['plan-templates'],
    queryFn: plansApi.listTemplates,
    enabled: templateOpen,
    staleTime: 5 * 60_000,
  });
  const templates = templatesQ.data?.results || templatesQ.data || [];

  const instantiateMutation = useMutation({
    mutationFn: ({ id, title }) =>
      plansApi.instantiateTemplate(id, title.trim() ? { title: title.trim() } : {}),
    onSuccess: (plan) => {
      toast.success('Plan created from template');
      qc.invalidateQueries({ queryKey: ['plans'] });
      setTemplateOpen(false);
      setTemplateId(null);
      setTemplateTitle('');
      navigate(`/plans/${plan.id}`);
    },
    onError: (e) => {
      toast.error(e?.response?.data?.error?.detail || e?.message || 'Could not create plan from template');
    },
  });

  const createMutation = useMutation({
    mutationFn: plansApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      setShowCreate(false);
      setNewPlan({ title: '', description: '', plan_type: 'study', start_date: '', target_date: '' });
      toast.success('Plan created');
    },
    onError: (e) => {
      toast.error(e?.response?.data?.error?.detail || e?.message || 'Could not create plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: plansApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      setPlanToDelete(null);
      toast.success('Plan deleted');
    },
    onError: () => {
      toast.error('Could not delete plan');
    },
  });

  const plans = data?.results || data || [];

  return (
    <AppShell
      title="Study Plans"
      description="Create and track your learning plans, milestones, and tasks."
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate className="h-3.5 w-3.5" /> From template
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)} data-testid="plans-create-btn">
            <Plus className="h-3.5 w-3.5" /> New plan
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex items-center gap-2" role="group" aria-label="Filter plans by status">
        {['', 'active', 'completed', 'paused'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Create new plan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="plan-title" className="mb-1 block text-[11px] font-medium text-muted-foreground">Title</label>
              <input
                id="plan-title"
                value={newPlan.title}
                onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                placeholder="Plan title"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="plan-type" className="mb-1 block text-[11px] font-medium text-muted-foreground">Type</label>
              <select
                id="plan-type"
                value={newPlan.plan_type}
                onChange={(e) => setNewPlan({ ...newPlan, plan_type: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="study">Study Plan</option>
                <option value="workflow">Workflow</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="col-span-full">
              <label htmlFor="plan-description" className="mb-1 block text-[11px] font-medium text-muted-foreground">Description (optional)</label>
              <textarea
                id="plan-description"
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div>
              <label htmlFor="plan-start" className="mb-1 block text-[11px] font-medium text-muted-foreground">Start date</label>
              <input
                id="plan-start"
                type="date"
                value={newPlan.start_date}
                onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="plan-target" className="mb-1 block text-[11px] font-medium text-muted-foreground">Target date</label>
              <input
                id="plan-target"
                type="date"
                value={newPlan.target_date}
                onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              disabled={!newPlan.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newPlan)}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create plan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Plans list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[120px] rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Target}
          title={statusFilter ? `No ${statusFilter} plans` : 'No plans yet'}
          description={statusFilter ? 'Try a different status filter.' : 'Create your first study plan to organize your learning journey.'}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const completedTasks = plan.completed_task_count || 0;
            const totalTasks = plan.task_count || 0;
            const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={plan.id} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      <Link to={`/plans/${plan.id}`} className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">
                        {plan.title}
                      </Link>
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', STATUS_STYLES[plan.status] || STATUS_STYLES.active)}>
                        {plan.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[plan.plan_type] || plan.plan_type}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlanToDelete(plan)}
                    aria-label={`Delete plan ${plan.title || ''}`}
                    className="rounded p-1 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {plan.description && (
                  <p className="mt-2 line-clamp-2 text-[12px] text-muted-foreground">{plan.description}</p>
                )}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{completedTasks}/{totalTasks} tasks</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${plan.title || 'Plan'} progress ${pct} percent`}
                    />
                  </div>
                </div>
                {plan.target_date && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    Target: {new Date(plan.target_date).toLocaleDateString()}
                  </div>
                )}
                <div className="mt-3 border-t pt-2.5">
                  <Link
                    to={`/plans/${plan.id}`}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline"
                  >
                    Open plan <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!planToDelete}
        title="Delete plan?"
        description={`“${planToDelete?.title || ''}” and its milestones and tasks will be permanently deleted. This cannot be undone.`}
        onCancel={() => setPlanToDelete(null)}
        onConfirm={() => deleteMutation.mutate(planToDelete.id)}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
      />

      <TemplatePickerDialog
        open={templateOpen}
        templates={templates}
        loading={templatesQ.isLoading}
        error={templatesQ.error}
        onRetry={() => templatesQ.refetch()}
        selectedId={templateId}
        onSelect={setTemplateId}
        title={templateTitle}
        onTitle={setTemplateTitle}
        pending={instantiateMutation.isPending}
        onClose={() => {
          setTemplateOpen(false);
          setTemplateId(null);
          setTemplateTitle('');
        }}
        onConfirm={() => templateId && instantiateMutation.mutate({ id: templateId, title: templateTitle })}
      />
    </AppShell>
  );
}

function templateCounts(t) {
  const milestones = Array.isArray(t?.template_data?.milestones) ? t.template_data.milestones : [];
  const tasks = milestones.reduce(
    (n, m) => n + (Array.isArray(m?.tasks) ? m.tasks.length : 0),
    0,
  );
  return { milestones: milestones.length, tasks };
}

function TemplatePickerDialog({
  open, templates, loading, error, onRetry,
  selectedId, onSelect, title, onTitle, pending, onClose, onConfirm,
}) {
  const [filter, setFilter] = useState('');

  const filtered = templates.filter((t) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (TYPE_LABELS[t.plan_type] || t.plan_type || '').toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setFilter(''); else onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <LayoutTemplate className="h-4 w-4 text-primary" aria-hidden />
            Start from a template
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick an institution template — its milestones and tasks are copied into a new personal plan.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Loading templates">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
              <span>Could not load templates.</span>
              <Button type="button" variant="outline" size="sm" onClick={onRetry} className="h-7 shrink-0 text-[11px]">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : templates.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No templates yet — your institution can add reusable plan templates for everyone.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search templates…"
                aria-label="Search templates"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <div role="radiogroup" aria-label="Plan templates" className="space-y-2">
              {filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                  No templates match “{filter.trim()}”.
                </p>
              ) : filtered.map((t) => {
                const counts = templateCounts(t);
                const milestones = Array.isArray(t?.template_data?.milestones)
                  ? t.template_data.milestones
                  : [];
                const selected = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                      selected
                        ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
                        : 'hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-[var(--border-strong)]',
                    )} aria-hidden>
                      {selected && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                      {t.description && (
                        <span className="mt-0.5 line-clamp-2 block text-[11.5px] text-muted-foreground">
                          {t.description}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground num">
                        {counts.milestones} milestone{counts.milestones === 1 ? '' : 's'} · {counts.tasks} task{counts.tasks === 1 ? '' : 's'} · {TYPE_LABELS[t.plan_type] || t.plan_type}
                      </span>
                      {milestones.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {milestones.slice(0, 3).map((m, i) => (
                            <span
                              key={i}
                              className="inline-flex max-w-[180px] items-center truncate rounded-full border bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] text-muted-foreground"
                            >
                              {m.title || `Milestone ${i + 1}`}
                            </span>
                          ))}
                          {milestones.length > 3 && (
                            <span className="inline-flex items-center px-1 text-[10.5px] text-muted-foreground">
                              +{milestones.length - 3} more
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-title" className="text-xs">Plan title (optional)</Label>
              <Input
                id="template-title"
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="Defaults to the template name"
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedId || pending}
            onClick={onConfirm}
            className="gap-1.5"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {pending ? 'Creating…' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
