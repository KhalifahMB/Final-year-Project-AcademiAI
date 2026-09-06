import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EntityDialog from '@/components/shared/EntityDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flag,
  Loader2,
  Milestone,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

const PLAN_STATUSES = ['active', 'paused', 'completed', 'archived'];
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const STATUS_STYLES = {
  active: 'bg-[var(--info-soft)] text-[var(--info)]',
  completed: 'bg-[var(--success-soft)] text-[var(--success)]',
  done: 'bg-[var(--success-soft)] text-[var(--success)]',
  paused: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  pending: 'bg-[var(--surface-2)] text-[var(--muted)]',
  todo: 'bg-[var(--surface-2)] text-[var(--muted)]',
  in_progress: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  skipped: 'bg-[var(--surface-2)] text-[var(--muted)]',
  archived: 'bg-[var(--surface-2)] text-[var(--muted)]',
};

function StatusPill({ status }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
      STATUS_STYLES[status] || STATUS_STYLES.pending,
    )}>
      {String(status || 'pending').replace('_', ' ')}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMinutes(min) {
  if (min == null || min === '') return null;
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [milestoneDialog, setMilestoneDialog] = useState(null); // 'new' | milestone object
  const [taskDialog, setTaskDialog] = useState(null); // {mode:'new', milestone} | {mode:'edit', task, milestone}
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [deleteMilestone, setDeleteMilestone] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [modalError, setModalError] = useState('');

  const planQ = useQuery({
    queryKey: ['plan', id],
    queryFn: () => plansApi.get(id),
    enabled: !!id,
  });
  const plan = planQ.data || null;
  const milestones = [...(plan?.milestones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['plan', id] });
    qc.invalidateQueries({ queryKey: ['plans'] });
  };

  const updatePlan = useMutation({
    mutationFn: (payload) => plansApi.update(id, payload),
    onSuccess: () => {
      toast.success('Plan updated');
      setEditPlanOpen(false);
      setModalError('');
      invalidate();
    },
    onError: (e) => {
      const msg = e?.response?.data?.error?.detail || 'Could not update plan';
      setModalError(msg);
      toast.error(msg);
    },
  });

  const deletePlan = useMutation({
    mutationFn: () => plansApi.delete(id),
    onSuccess: () => {
      toast.success('Plan deleted');
      qc.invalidateQueries({ queryKey: ['plans'] });
      navigate('/plans', { replace: true });
    },
    onError: () => toast.error('Could not delete plan'),
  });

  const saveMilestone = useMutation({
    mutationFn: ({ milestoneId, payload }) =>
      milestoneId
        ? plansApi.updateMilestone(milestoneId, payload)
        : plansApi.createMilestone({ ...payload, plan: id }),
    onSuccess: (_, vars) => {
      toast.success(vars.milestoneId ? 'Milestone updated' : 'Milestone added');
      setMilestoneDialog(null);
      setModalError('');
      invalidate();
    },
    onError: (e) => {
      const msg = e?.response?.data?.error?.detail || 'Could not save milestone';
      setModalError(msg);
      toast.error(msg);
    },
  });

  const removeMilestone = useMutation({
    mutationFn: (mid) => plansApi.deleteMilestone(mid),
    onSuccess: () => {
      toast.success('Milestone deleted');
      setDeleteMilestone(null);
      invalidate();
    },
    onError: () => toast.error('Could not delete milestone'),
  });

  const saveTask = useMutation({
    mutationFn: ({ taskId, milestoneId, payload }) =>
      taskId
        ? plansApi.updateTask(taskId, payload)
        : plansApi.createTask({ ...payload, milestone: milestoneId }),
    onSuccess: (_, vars) => {
      toast.success(vars.taskId ? 'Task updated' : 'Task added');
      setTaskDialog(null);
      setModalError('');
      invalidate();
    },
    onError: (e) => {
      const msg = e?.response?.data?.error?.detail || 'Could not save task';
      setModalError(msg);
      toast.error(msg);
    },
  });

  const removeTask = useMutation({
    mutationFn: (tid) => plansApi.deleteTask(tid),
    onSuccess: () => {
      toast.success('Task deleted');
      setDeleteTask(null);
      invalidate();
    },
    onError: () => toast.error('Could not delete task'),
  });

  const toggleTask = useMutation({
    mutationFn: ({ task }) =>
      task.status === 'done'
        ? plansApi.updateTask(task.id, { status: 'todo' })
        : plansApi.completeTask(task.id),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Could not update task'),
  });

  const allTasks = milestones.flatMap((m) => m.tasks || []);
  const doneTasks = allTasks.filter((t) => t.status === 'done').length;
  const pct = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  const openNewMilestone = () => {
    setModalError('');
    setMilestoneDialog('new');
  };
  const openEditMilestone = (m) => {
    setModalError('');
    setMilestoneDialog(m);
  };
  const openNewTask = (milestone) => {
    setModalError('');
    setTaskDialog({ mode: 'new', milestone });
  };
  const openEditTask = (task, milestone) => {
    setModalError('');
    setTaskDialog({ mode: 'edit', task, milestone });
  };

  return (
    <AppShell
      title={plan?.title || 'Study plan'}
      description={plan ? `${plan.plan_type || 'study'} plan · ${doneTasks}/${allTasks.length} tasks complete` : 'Plan details, milestones and tasks.'}
      actions={
        plan ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
              <Link to="/plans">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All plans
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs capitalize">
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  {plan.status || 'active'}
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLAN_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    disabled={s === plan.status || updatePlan.isPending}
                    onClick={() => updatePlan.mutate({ status: s })}
                    className="capitalize"
                  >
                    {s === plan.status ? <CheckCircle2 className="mr-2 h-3.5 w-3.5" aria-hidden /> : <span className="mr-2 w-3.5" />}
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => { setModalError(''); setEditPlanOpen(true); }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeletePlanOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      {planQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[120px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ) : planQ.error || !plan ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Could not load this plan. It may have been deleted.</span>
            <Button asChild variant="outline" size="sm" className="h-7 shrink-0 text-[11px]">
              <Link to="/plans">Back to plans</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Overview */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={plan.status} />
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold capitalize text-[var(--accent-strong)]">
                {plan.plan_type || 'study'} plan
              </span>
              {(plan.target_date || plan.start_date) && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  {plan.start_date ? fmtDate(plan.start_date) : '—'} → {plan.target_date ? fmtDate(plan.target_date) : '—'}
                </span>
              )}
            </div>
            {plan.description && (
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{plan.description}</p>
            )}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{doneTasks} of {allTasks.length} tasks done</span>
                <span className="num font-semibold text-foreground">{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Plan progress ${pct} percent`}
                />
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Milestone className="h-4 w-4 text-primary" aria-hidden />
              Milestones
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground num">
                {milestones.length}
              </span>
            </h2>
            <Button type="button" size="sm" onClick={openNewMilestone} className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add milestone
            </Button>
          </div>

          {milestones.length === 0 ? (
            <EmptyState
              icon={Milestone}
              title="No milestones yet"
              description="Break this plan into milestones, then add tasks to each one."
              action="Add your first milestone"
              onAction={openNewMilestone}
            />
          ) : (
            <ol className="space-y-3">
              {milestones.map((m, idx) => {
                const tasks = m.tasks || [];
                const done = tasks.filter((t) => t.status === 'done').length;
                return (
                  <li key={m.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Milestone {idx + 1}
                        </p>
                        <h3 className="mt-0.5 truncate text-[15px] font-semibold">{m.title}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <StatusPill status={m.status} />
                          {m.due_date && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" aria-hidden /> Due {fmtDate(m.due_date)}
                            </span>
                          )}
                          <span className="num">{done}/{tasks.length} tasks</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => openNewTask(m)}
                        >
                          <Plus className="h-3 w-3" aria-hidden /> Task
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Edit milestone ${m.title}`}
                          onClick={() => openEditMilestone(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete milestone ${m.title}`}
                          onClick={() => setDeleteMilestone(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {m.description && (
                      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{m.description}</p>
                    )}
                    {tasks.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 border-t pt-3">
                        {tasks.map((t) => {
                          const isDone = t.status === 'done';
                          const pending = toggleTask.isPending && toggleTask.variables?.task?.id === t.id;
                          return (
                            <li
                              key={t.id}
                              className={cn(
                                'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                                isDone ? 'border-transparent bg-[var(--success-soft)]/40' : 'border-[var(--border)] hover:bg-[var(--hover)]',
                              )}
                            >
                              <Checkbox
                                checked={isDone}
                                disabled={pending}
                                onCheckedChange={() => toggleTask.mutate({ task: t })}
                                aria-label={`Mark task ${t.title} as ${isDone ? 'not done' : 'done'}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  'truncate text-[13px] font-medium',
                                  isDone && 'text-muted-foreground line-through',
                                )}>
                                  {t.title}
                                </p>
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                  <StatusPill status={t.status} />
                                  {fmtMinutes(t.estimated_minutes) && (
                                    <span className="num">~{fmtMinutes(t.estimated_minutes)}</span>
                                  )}
                                  {t.completed_at && <span>Completed {fmtDate(t.completed_at)}</span>}
                                </p>
                              </div>
                              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                aria-label={`Edit task ${t.title}`}
                                onClick={() => openEditTask(t, m)}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete task ${t.title}`}
                                onClick={() => setDeleteTask({ task: t, milestone: m })}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-center text-[11.5px] text-muted-foreground">
                        No tasks yet — add the first one.
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* Edit plan */}
      <EntityDialog
        open={editPlanOpen}
        title="Edit plan"
        fields={[
          { name: 'title', label: 'Title', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          {
            name: 'plan_type', label: 'Type', type: 'select',
            options: [
              { value: 'study', label: 'Study plan' },
              { value: 'workflow', label: 'Workflow' },
              { value: 'personal', label: 'Personal' },
            ],
          },
          {
            name: 'status', label: 'Status', type: 'select',
            options: PLAN_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
          },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'target_date', label: 'Target date', type: 'date' },
        ]}
        initial={plan || undefined}
        pending={updatePlan.isPending}
        error={modalError}
        onClose={() => setEditPlanOpen(false)}
        onSubmit={(payload) => updatePlan.mutate(payload)}
      />

      {/* Add/edit milestone */}
      <EntityDialog
        open={!!milestoneDialog}
        title={milestoneDialog === 'new' ? 'Add milestone' : `Edit milestone`}
        fields={[
          { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Master week 1–3 material' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'due_date', label: 'Due date', type: 'date' },
          {
            name: 'status', label: 'Status', type: 'select',
            options: MILESTONE_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) })),
          },
        ]}
        initial={milestoneDialog !== 'new' ? milestoneDialog || undefined : undefined}
        pending={saveMilestone.isPending}
        error={modalError}
        onClose={() => setMilestoneDialog(null)}
        onSubmit={(payload) => saveMilestone.mutate({
          milestoneId: milestoneDialog !== 'new' ? milestoneDialog?.id : null,
          payload,
        })}
      />

      {/* Add/edit task */}
      <EntityDialog
        open={!!taskDialog}
        title={taskDialog?.mode === 'edit' ? 'Edit task' : `Add task${taskDialog?.milestone ? ` — ${taskDialog.milestone.title}` : ''}`}
        fields={[
          { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Read chapter 4' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'estimated_minutes', label: 'Estimated minutes', type: 'number', placeholder: '30' },
          {
            name: 'status', label: 'Status', type: 'select',
            options: TASK_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) })),
          },
        ]}
        initial={taskDialog?.mode === 'edit' ? taskDialog.task : undefined}
        pending={saveTask.isPending}
        error={modalError}
        onClose={() => setTaskDialog(null)}
        onSubmit={(payload) => {
          if (payload.estimated_minutes === '' || payload.estimated_minutes == null) {
            delete payload.estimated_minutes;
          }
          saveTask.mutate({
            taskId: taskDialog?.mode === 'edit' ? taskDialog.task?.id : null,
            milestoneId: taskDialog?.milestone?.id,
            payload,
          });
        }}
      />

      {/* Deletes */}
      <ConfirmDialog
        open={deletePlanOpen}
        title={`Delete “${plan?.title || 'plan'}”?`}
        description="The plan, its milestones and all tasks will be permanently deleted. This cannot be undone."
        confirmLabel="Delete plan"
        destructive
        pending={deletePlan.isPending}
        onConfirm={() => deletePlan.mutate()}
        onCancel={() => setDeletePlanOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteMilestone}
        title={`Delete milestone “${deleteMilestone?.title || ''}”?`}
        description="Its tasks will be permanently deleted too. This cannot be undone."
        confirmLabel="Delete milestone"
        destructive
        pending={removeMilestone.isPending}
        onConfirm={() => removeMilestone.mutate(deleteMilestone.id)}
        onCancel={() => setDeleteMilestone(null)}
      />
      <ConfirmDialog
        open={!!deleteTask}
        title={`Delete task “${deleteTask?.task?.title || ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete task"
        destructive
        pending={removeTask.isPending}
        onConfirm={() => removeTask.mutate(deleteTask.task.id)}
        onCancel={() => setDeleteTask(null)}
      />
    </AppShell>
  );
}
