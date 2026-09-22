import { useMemo } from 'react';
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { CalendarRange, Plus } from 'lucide-react';
import { layerColor } from './utils';

export default function MonthStrip({
  current,
  selectedDate,
  events,
  onSelectDay,
  onNewDay,
  onEventClick,
  canEdit,
  bindHover,
}) {
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);

  const busyDays = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      let d = startOfDay(parseISO(e.start));
      const endD = e.end ? startOfDay(parseISO(e.end)) : d;
      let guard = 0;
      while (d <= endD && guard < 40) {
        if (d >= monthStart && d <= monthEnd) {
          const key = d.toISOString().slice(0, 10);
          map.set(key, [...(map.get(key) || []), e]);
        }
        if (d.getTime() === endD.getTime()) break;
        d = addDays(d, 1);
        guard += 1;
      }
    }
    return [...map.entries()]
      .map(([key, evs]) => ({ day: parseISO(key), events: evs }))
      .sort((a, b) => a.day - b.day);
  }, [events, monthStart, monthEnd]);

  if (busyDays.length === 0) {
    return (
      <div className="py-16">
        <EmptyState
          icon={CalendarRange}
          title="No busy days this month"
          description="Toggle off “Events only” to browse the full calendar."
        />
      </div>
    );
  }

  return (
    <div>
      {busyDays.map(({ day, events: evs }) => {
        const today = isToday(day);
        const selected = isSameDay(day, selectedDate);
        return (
          <div
            key={day.toISOString()}
            onClick={() => onSelectDay(day)}
            className={cn(
              'group flex cursor-pointer items-start gap-3 border-b border-[var(--border)] px-3 py-2 transition-colors hover:bg-[var(--hover)] last:border-b-0',
              selected && 'bg-[var(--accent-soft)]/60 hover:bg-[var(--accent-soft)]',
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNewDay(day);
              }}
              className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--accent-strong)]"
              aria-label="Add event"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 py-0.5">
              <span className="text-[9px] font-[560] uppercase tracking-[0.08em] text-[var(--muted)]">
                {format(day, 'EEE')}
              </span>
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-[600]',
                  today
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : 'text-[var(--fg)]',
                )}
              >
                {format(day, 'd')}
              </span>
              <span className="num text-[9.5px] text-[var(--faint)]">
                {format(day, 'MMM')}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5">
              {evs.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (canEdit(e)) onEventClick(e);
                  }}
                  title={e.title}
                  {...bindHover(e)}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-transparent bg-[var(--surface-2)] px-2 py-1 text-[11px] font-[520] leading-tight text-[var(--fg-soft)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
                    e.status === 'cancelled' && 'opacity-45',
                  )}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: layerColor(e.layer) }}
                  />
                  {!e.all_day && (
                    <span className="num shrink-0 text-[10px] text-[var(--muted)]">
                      {format(parseISO(e.start), 'h:mm a')}
                    </span>
                  )}
                  <span className="truncate">{e.title}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
