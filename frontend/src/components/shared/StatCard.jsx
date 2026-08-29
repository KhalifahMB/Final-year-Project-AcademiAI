import { cn } from '@/lib/utils';

/**
 * StatCard — KPI tile for admin/lecturer dashboards.
 * Hairline border, no shadow; accent-soft icon tile with accent-strong glyph;
 * trend chip uses semantic status tokens.
 */
export default function StatCard({ icon: Icon, label, value, hint, trend, className }) {
  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-1 text-[24px] font-[650] leading-none tracking-[-0.02em] num">
            {value ?? '—'}
          </p>
          {hint ? (
            <p className="mt-1.5 truncate text-[11.5px] text-[var(--muted)]">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
      </div>
      {trend ? (
        <div
          className={cn(
            'mt-3 inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[10.5px] font-[600]',
            trend.positive
              ? 'bg-[var(--success-soft)] text-[var(--success)]'
              : 'bg-[var(--danger-soft)] text-[var(--danger)]',
          )}
        >
          {trend.label}
        </div>
      ) : null}
    </div>
  );
}
