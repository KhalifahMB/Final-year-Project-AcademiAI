import { formatRelativeTime } from '@/lib/utils';

// eslint-disable-next-line react-refresh/only-export-components
export function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

// Shared progress meter (single source — Student + Lecturer dashboards).
// eslint-disable-next-line react-refresh/only-export-components
export function Meter({ pct, tone = 'accent' }) {
  const toneColor = {
    accent: 'bg-[var(--accent)]',
    ok: 'bg-[var(--success)]',
    warn: 'bg-[var(--warn)]',
    bad: 'bg-[var(--danger)]',
  }[tone];
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <span className="meter" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(clamped)}%`}>
      <span className={toneColor} style={{ width: `${Math.max(4, clamped)}%` }} />
    </span>
  );
}
