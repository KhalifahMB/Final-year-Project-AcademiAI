import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { BrainCircuit, TrendingUp } from 'lucide-react';

export default function ProgressPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data } = await api.get('/progress/');
      return data.results || data;
    },
  });

  const list = data || [];
  const avg = list.length
    ? Math.round(list.reduce((s, p) => s + (Number(p.progress_value) || 0), 0) / list.length)
    : 0;

  return (
    <AppShell
      title="Learning progress"
      description="Your mastery across concepts the AI has tracked from your interactions."
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[100px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="No progress tracked yet"
          description="As you interact with materials, quizzes, and chat, the system builds a picture of what you've mastered."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatTile label="Concepts tracked" value={list.length} icon={BrainCircuit} />
            <StatTile label="Average mastery" value={`${avg}%`} icon={TrendingUp} tone="violet" />
            <StatTile
              label="Mastered (≥80%)"
              value={list.filter((p) => Number(p.progress_value) >= 80).length}
              tone="emerald"
            />
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const value = Number(p.progress_value) || 0;
              const tone =
                value >= 80 ? 'emerald'
                : value >= 50 ? 'amber'
                : 'red';
              return (
                <li key={p.id}>
                  <div className="rounded-xl border bg-card p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{p.concept}</p>
                      <span className={cn(
                        'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                        tone === 'emerald' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        tone === 'amber' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        tone === 'red' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                      )}>
                        {value}%
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          tone === 'emerald' && 'bg-emerald-500',
                          tone === 'amber' && 'bg-amber-500',
                          tone === 'red' && 'bg-red-500',
                        )}
                        style={{ width: `${Math.min(100, value)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AppShell>
  );
}

function StatTile({ label, value, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-primary bg-primary/10',
    emerald: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    amber: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
    violet: 'text-violet-600 bg-violet-500/10 dark:text-violet-400',
    red: 'text-red-600 bg-red-500/10 dark:text-red-400',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      {Icon && <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}><Icon className="h-4 w-4" aria-hidden /></span>}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums tracking-tight">{value ?? 0}</p>
      </div>
    </div>
  );
}
