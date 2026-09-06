import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import StatTile from '@/components/shared/StatTile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrainCircuit, TrendingUp } from 'lucide-react';

export default function ProgressPage() {
 const { data, isLoading, error, refetch } = useQuery({
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
 ) : error ? (
 <Alert variant="destructive" role="alert">
 <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
 <span>Could not load progress{error?.response?.data?.detail ? `: ${error.response.data.detail}` : ''}</span>
 <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="h-7 shrink-0 text-[11px]">
 Retry
 </Button>
 </AlertDescription>
 </Alert>
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
 tone === 'emerald' && 'bg-[var(--success-soft)] text-[var(--success)] ',
 tone === 'amber' && 'bg-[var(--warn-soft)] text-[var(--warn)]',
 tone === 'red' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
 )}>
 {value}%
 </span>
 </div>
 <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
 <div
 className={cn(
 'h-full rounded-full',
 tone === 'emerald' && 'bg-[var(--success)]',
 tone === 'amber' && 'bg-[var(--warn)]',
 tone === 'red' && 'bg-[var(--danger)]',
 )}
 style={{ width: `${Math.min(100, value)}%` }}
 role="progressbar"
 aria-valuenow={Math.round(Math.min(100, value))}
 aria-valuemin={0}
 aria-valuemax={100}
 aria-label={`${p.concept} mastery ${Math.round(Math.min(100, value))} percent`}
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
