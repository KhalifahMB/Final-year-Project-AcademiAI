import { format, isSameDay, parseISO } from 'date-fns';
import { MapPin } from 'lucide-react';
import { HOURS, LAYER_LABELS } from './constants';
import { hourLabel, layerColor } from './utils';

export default function DayView({
  current,
  events,
  onNewDay,
  onEventClick,
  canEdit,
}) {
  const dayEvents = events
    .filter((e) => !e.all_day && isSameDay(parseISO(e.start), current))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const allDayEvents = events.filter(
    (e) => e.all_day && isSameDay(parseISO(e.start), current),
  );

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3">
        <h3 className="text-[15px] font-[640]">
          {format(current, 'EEEE, MMMM d, yyyy')}
        </h3>
        <div className="flex gap-1.5">
          {[...allDayEvents, ...dayEvents].slice(0, 8).map((e) => (
            <span
              key={e.id}
              className="inline-block h-2.5 w-5 rounded-full"
              style={{ backgroundColor: layerColor(e.layer) }}
            />
          ))}
        </div>
      </div>

      {allDayEvents.length > 0 && (
        <div className="space-y-1 border-b border-[var(--border)] px-4 py-2.5">
          <span className="text-[9.5px] font-[560] uppercase tracking-[0.08em] text-[var(--faint)]">
            All-day
          </span>
          {allDayEvents.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => canEdit(e) && onEventClick(e)}
              title={e.title}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--surface-2)] px-2 py-1.5 text-left text-[12.5px] font-[560] text-[var(--fg-soft)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: layerColor(e.layer) }}
              />
              <span className="truncate">{e.title}</span>
              <span className="ml-auto rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9.5px] font-[550] uppercase tracking-wide text-[var(--muted)]">
                {LAYER_LABELS[e.layer] || e.layer}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[72px_1fr]">
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
        <div className="relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-14 border-b border-[var(--border)] transition-colors hover:bg-[var(--hover)]"
              onClick={() => {
                const dt = new Date(current);
                dt.setHours(h, 0, 0, 0);
                onNewDay(dt);
              }}
            />
          ))}
          {dayEvents.map((e) => {
            const s = parseISO(e.start);
            const mins = s.getHours() * 60 + s.getMinutes();
            const dur = e.duration_minutes || 60;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => canEdit(e) && onEventClick(e)}
                className="absolute left-0 right-0 mx-1 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-left text-[11px] leading-tight text-[var(--fg)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
                style={{
                  top: `${(mins / 60) * 56}px`,
                  height: `${Math.max((dur / 60) * 56 - 2, 22)}px`,
                }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-0.5"
                  style={{ backgroundColor: layerColor(e.layer) }}
                />
                <span className="block truncate pl-1 font-[620]">{e.title}</span>
                <span className="block truncate pl-1 text-[9.5px] text-[var(--muted)]">
                  {format(s, 'h:mm a')}
                  {e.end ? ` – ${format(parseISO(e.end), 'h:mm a')}` : ''}
                </span>
                {e.venue && (
                  <div className="mt-0.5 flex items-center gap-0.5 pl-1 opacity-80">
                    <MapPin className="h-2.5 w-2.5" /> {e.venue}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
