import { cn } from '@/lib/utils';

export default function StatCard({ icon: Icon, label, value, hint, trend, className }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {value ?? '—'}
          </p>
          {hint ? (
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <Icon className="h-[17px] w-[17px]" aria-hidden />
          </div>
        ) : null}
      </div>
      {trend ? (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            trend.positive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400',
          )}
        >
          {trend.label}
        </div>
      ) : null}
    </div>
  );
}
