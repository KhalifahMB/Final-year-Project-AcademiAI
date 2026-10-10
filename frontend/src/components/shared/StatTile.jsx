import { cn } from '@/lib/utils';

/**
 * StatTile — compact stat for catalogue-style pages (courses, enrollments).
 * Plain bordered tile (not the glass/neomorph dashboard StatCard).
 *
 * Tones are semantic, never decorative: `neutral` (default) for plain
 * counts, `accent` for a page's headline metric, and ok/warn/bad/info
 * only when the number itself carries status (ready/failed buckets,
 * threshold-gated scores). See DESIGN.md → Color System.
 *
 * Inside a <StatStrip> the tile flattens into a divided segment of one
 * panel (see `.kpi-strip` in components.css).
 */
export default function StatTile({ label, value, suffix = '', icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-fg-soft bg-surface-2',
    accent: 'text-[var(--accent-strong)] bg-[var(--accent-soft)]',
    ok: 'text-[var(--success)] bg-[var(--success-soft)]',
    warn: 'text-[var(--warn)] bg-[var(--warn-soft)]',
    bad: 'text-[var(--danger)] bg-[var(--danger-soft)]',
    info: 'text-[var(--info)] bg-[var(--info-soft)]',
  };
  return (
    <div className="stat-tile flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
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
          {value ?? 0}{suffix}
        </p>
      </div>
    </div>
  );
}
