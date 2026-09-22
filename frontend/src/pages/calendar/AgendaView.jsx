import { format, parseISO } from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';
import { EmptyCalendarIllustration } from '@/components/shared/illustrations';
import { Clock, MapPin, Tag } from 'lucide-react';
import { LAYER_LABELS } from './constants';
import { layerColor } from './utils';

export default function AgendaView({
  events,
  onEventClick,
  onDayClick,
  canEdit,
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start) - new Date(b.start),
  );
  if (sorted.length === 0) {
    return (
      <div className="py-16">
        <EmptyState
          illustration={EmptyCalendarIllustration}
          title="No upcoming events"
          description="Schedule a study session or check your toggled layers."
        />
      </div>
    );
  }

  const groups = {};
  for (const e of sorted) {
    const day = format(parseISO(e.start), 'yyyy-MM-dd');
    (groups[day] = groups[day] || []).push(e);
  }

  return (
    <div className="space-y-6 p-4">
      {Object.entries(groups).map(([day, dayEvents]) => (
        <div key={day}>
          <button
            type="button"
            onClick={() => onDayClick(parseISO(day))}
            className="group mb-2 flex items-baseline gap-2 text-left"
          >
            <span className="text-[14px] font-[640] text-[var(--fg)] transition-colors group-hover:text-[var(--accent-strong)]">
              {format(parseISO(day), 'EEEE, MMMM d')}
            </span>
            <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-[560] text-[var(--muted)] num">
              {dayEvents.length}
            </span>
          </button>
          <div className="space-y-1.5">
            {dayEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => canEdit(e) && onEventClick(e)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
              >
                <span
                  className="inline-block h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: layerColor(e.layer) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-[600] text-[var(--fg)]">
                    {e.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(e.start), 'h:mm a')}
                      {e.end ? ` – ${format(parseISO(e.end), 'h:mm a')}` : ''}
                    </span>
                    {e.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {e.venue}
                      </span>
                    )}
                    {e.course_code && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {e.course_code}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-[550] uppercase tracking-wide text-[var(--muted)]">
                  {LAYER_LABELS[e.layer] || e.layer}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
