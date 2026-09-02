import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarClock, Loader2, Plus, Target, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  paused: 'bg-amber-500/10 text-amber-600',
  archived: 'bg-gray-500/10 text-gray-500',
};

const TYPE_LABELS = {
  study: 'Study Plan',
  workflow: 'Workflow',
  personal: 'Personal',
};

export default function PlansPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '', description: '', plan_type: 'study', start_date: '', target_date: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['plans', statusFilter],
    queryFn: () => plansApi.list({ status: statusFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: plansApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      setShowCreate(false);
      setNewPlan({ title: '', description: '', plan_type: 'study', start_date: '', target_date: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: plansApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });

  const plans = data?.results || data || [];

  return (
    <AppShell
      title="Study Plans"
      description="Create and track your learning plans, milestones, and tasks."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)} data-testid="plans-create-btn">
          <Plus className="h-3.5 w-3.5" /> New plan
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        {['', 'active', 'completed', 'paused'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
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
            <input
              value={newPlan.title}
              onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
              placeholder="Plan title"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <select
              value={newPlan.plan_type}
              onChange={(e) => setNewPlan({ ...newPlan, plan_type: e.target.value })}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="study">Study Plan</option>
              <option value="workflow">Workflow</option>
              <option value="personal">Personal</option>
            </select>
            <textarea
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
              placeholder="Description (optional)"
              className="col-span-full rounded-lg border bg-background px-3 py-2 text-sm"
              rows={2}
            />
            <input
              type="date"
              value={newPlan.start_date}
              onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={newPlan.target_date}
              onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            />
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
          title="No plans yet"
          description="Create your first study plan to organize your learning journey."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const completedTasks = plan.completed_task_count || 0;
            const totalTasks = plan.task_count || 0;
            const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={plan.id} className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{plan.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[plan.status] || STATUS_COLORS.active)}>
                        {plan.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[plan.plan_type] || plan.plan_type}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(plan.id)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
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
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {plan.target_date && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    Target: {new Date(plan.target_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
