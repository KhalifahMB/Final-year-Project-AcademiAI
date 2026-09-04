import { cn } from '@/lib/utils';

/**
 * StatTile — compact stat for catalogue-style pages (courses, enrollments).
 * Plain bordered tile (not the glass/neomorph dashboard StatCard).
 */
export default function StatTile({ label, value, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-primary bg-primary/10',
    emerald: 'text-[var(--success)] bg-[var(--success-soft)]',
    violet: 'text-[var(--accent-strong)] bg-[var(--accent-soft)]',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      {Icon && (
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            tones[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-semibold tabular-nums tracking-tight">
          {value ?? 0}
        </p>
      </div>
    </div>
  );
}
