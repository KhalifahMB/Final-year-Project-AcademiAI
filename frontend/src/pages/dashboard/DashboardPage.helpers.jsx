import { formatRelativeTime } from '@/lib/utils';

// eslint-disable-next-line react-refresh/only-export-components
export function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

// Shared progress meter (single source — Student + Lecturer dashboards).
// eslint-disable-next-line react-refresh/only-export-components
export function Meter({ pct, tone = 'accent', label }) {
  const toneColor = {
    accent: 'bg-[var(--accent)]',
    ok: 'bg-[var(--success)]',
    warn: 'bg-[var(--warn)]',
    bad: 'bg-[var(--danger)]',
  }[tone];
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  // At true 0% render an empty track (communicated by the background); only
  // nonzero progress gets the small minimum slice so 1% stays visible.
  const width = clamped > 0 ? Math.max(4, clamped) : 0;
  return (
    <span className="meter" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100} aria-label={label ? `${label}, ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}>
      <span className={toneColor} style={{ width: `${width}%` }} />
    </span>
  );
}
