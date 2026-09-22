import {
  addDays,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { HOURS } from './constants';
import { hourLabel, layerColor } from './utils';

export default function WeekView({
  current,
  events,
  onNewDay,
  onEventClick,
  canEdit,
}) {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      {/* Day header */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-[var(--border)] bg-[var(--surface-2)]/50">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="flex flex-col items-center gap-1 py-2">
              <span className="text-[10px] font-[560] uppercase tracking-[0.06em] text-[var(--muted)]">
                {format(d, 'EEE')}
              </span>
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-[640]',
                  today
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : 'text-[var(--fg)]',
                )}
              >
                {format(d, 'd')}
              </span>
              <span className="flex h-1 items-center gap-0.5">
                {events
                  .filter((e) => !e.all_day && isSameDay(parseISO(e.start), d))
                  .slice(0, 4)
                  .map((e) => (
                    <span
                      key={e.id}
                      className="h-1 w-1.5 rounded-full"
                      style={{ backgroundColor: layerColor(e.layer) }}
                    />
                  ))}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-[var(--border)]">
        <div className="flex items-center px-1 text-[9.5px] font-[560] uppercase tracking-wide text-[var(--faint)]">
          All-day
        </div>
        {days.map((d) => {
          const allDayEvents = events.filter(
            (e) => e.all_day && isSameDay(parseISO(e.start), d),
          );
          return (
            <div
              key={d.toISOString()}
              className="min-h-[28px] space-y-0.5 border-l border-[var(--border)] p-0.5 max-md:min-h-[auto]"
            >
              {allDayEvents.slice(0, 2).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => canEdit(e) && onEventClick(e)}
                  title={e.title}
                  className="flex w-full items-center gap-1 truncate rounded-[var(--radius-sm)] border border-transparent bg-[var(--surface-2)] px-1 py-0.5 text-left text-[10px] font-[520] text-[var(--fg-soft)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: layerColor(e.layer) }}
                  />
                  <span className="truncate">{e.title}</span>
                </button>
              ))}
              {allDayEvents.length > 2 && (
                <div className="px-1 text-[9.5px] font-[560] text-[var(--faint)]">
                  +{allDayEvents.length - 2}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)]">
        <div className="border-r border-[var(--border)] bg-[var(--surface-2)]/40">
          {HOURS.map((h) => (
            <div
              key={h}
              className="relative h-14 border-b border-[var(--border)] pr-1 text-right align-top"
            >
              <span className="absolute -top-2 right-1.5 text-[9.5px] font-[540] text-[var(--faint)]">
                {hourLabel(h)}
              </span>
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayEvents = events.filter(
            (e) => !e.all_day && isSameDay(parseISO(e.start), d),
          );
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'relative border-r border-[var(--border)] last:border-r-0',
                isToday(d) && 'bg-[var(--accent-soft)]/25',
              )}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="h-14 border-b border-[var(--border)] transition-colors hover:bg-[var(--hover)]"
                  onClick={() => {
                    const dt = new Date(d);
                    dt.setHours(h, 0, 0, 0);
                    onNewDay(dt);
                  }}
                />
              ))}
              {dayEvents
                .slice()
                .sort((a, b) => new Date(a.start) - new Date(b.start))
                .map((e) => {
                  const s = parseISO(e.start);
                  const mins = s.getHours() * 60 + s.getMinutes();
                  const dur = e.duration_minutes || 60;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => canEdit(e) && onEventClick(e)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-left text-[10px] leading-tight text-[var(--fg)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
                      style={{
                        top: `${(mins / 60) * 56}px`,
                        height: `${Math.max((dur / 60) * 56 - 2, 18)}px`,
                      }}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-0.5"
                        style={{ backgroundColor: layerColor(e.layer) }}
                      />
                      <span className="block truncate font-[600]">{e.title}</span>
                      <span className="block truncate text-[9px] text-[var(--muted)]">
                        {format(s, 'h:mm a')}
                        {e.end ? ` – ${format(parseISO(e.end), 'h:mm a')}` : ''}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
