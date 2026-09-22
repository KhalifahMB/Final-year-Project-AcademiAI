import { useState } from 'react';
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { GRID_HEADER_H, MAX_CHIPS, RIBBON_ROW } from './constants';
import {
  assignWeekLanes,
  eventFallsOn,
  isMultiDayEvent,
  layerColor,
  layerTint,
  weekSpan,
} from './utils';
import DayEventsDialog from './DayEventsDialog';

export default function MonthView({
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
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = [];

  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const [moreDay, setMoreDay] = useState(null);

  const multiDay = events.filter(isMultiDayEvent);
  const singleDay = events.filter((e) => !isMultiDayEvent(e));

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => (
          <div
            key={h}
            className="py-2 text-center text-[10.5px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]"
          >
            {h}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const ws = week[0];
        const we = endOfDay(week[6]);
        const spans = [];
        for (const e of multiDay) {
          const sp = weekSpan(e, week);
          if (!sp) continue;
          spans.push({
            e,
            colStart: sp.colStart,
            colEnd: sp.colEnd,
            continuesBefore: startOfDay(parseISO(e.start)) < ws,
            continuesAfter: e.end && startOfDay(parseISO(e.end)) > we,
          });
        }
        spans.sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd);
        const lanes = assignWeekLanes(spans);
        const ribbonRows = Math.min(lanes.length, 3);

        return (
          <div
            key={wi}
            className="relative border-b border-[var(--border)] last:border-b-0"
          >
            <div className="grid grid-cols-7">
              {week.map((day) => {
                const inMonth = isSameMonth(day, current);
                const today = isToday(day);
                const selected = isSameDay(day, selectedDate);
                const chipDocs = singleDay.filter((e) => eventFallsOn(e, day));
                const visible = chipDocs.slice(
                  0,
                  Math.max(1, MAX_CHIPS - ribbonRows),
                );
                const more = chipDocs.length - visible.length;
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      'group relative min-h-[84px] cursor-pointer border-r border-[var(--border)] p-1 transition-colors last:border-r-0 hover:bg-[var(--hover)]',
                      !inMonth &&
                        'bg-[var(--surface)]/40',
                      selected &&
                        'bg-[var(--accent-soft)]/60 hover:bg-[var(--accent-soft)]',
                    )}
                  >
                    <div className="flex h-6 items-center justify-between">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-[560] transition-colors',
                          today
                            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                            : selected
                              ? 'text-[var(--accent-strong)]'
                              : cn(
                                  'text-[var(--fg)]',
                                  !inMonth && 'text-[var(--faint)]',
                                ),
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewDay(day);
                        }}
                        className="rounded-full p-1 text-[var(--faint)] opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-visible:opacity-100"
                        aria-label="Add event"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div
                      className="space-y-0.5"
                      style={{ paddingTop: ribbonRows * RIBBON_ROW }}
                    >
                      {visible.map((e) => (
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
                            'flex w-full items-center gap-1 rounded-[var(--radius-sm)] border border-transparent bg-[var(--surface-2)] px-1 py-0.5 text-left text-[10.5px] font-[520] leading-tight text-[var(--fg-soft)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
                            e.status === 'cancelled' && 'opacity-45',
                          )}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: layerColor(e.layer) }}
                          />
                          {!e.all_day && (
                            <span className="num shrink-0 text-[9.5px] text-[var(--muted)]">
                              {format(parseISO(e.start), 'h:mm a')}
                            </span>
                          )}
                          <span className="truncate">{e.title}</span>
                        </button>
                      ))}
                      {more > 0 && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setMoreDay({ day, events: chipDocs });
                          }}
                          className="px-1 text-[10.5px] font-[560] text-[var(--muted)] hover:text-[var(--accent-strong)]"
                        >
                          <span className="num">{more}</span> more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {ribbonRows > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10"
                style={{ top: GRID_HEADER_H }}
              >
                {lanes
                  .slice(0, ribbonRows)
                  .map((lane, li) =>
                    lane.map(
                      ({
                        e,
                        colStart,
                        colEnd,
                        continuesBefore,
                        continuesAfter,
                      }) => {
                        const [tintBg] = layerTint(e.layer);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (canEdit(e)) onEventClick(e);
                            }}
                            title={e.title}
                            {...bindHover(e)}
                            className="pointer-events-auto absolute flex h-[16px] w-full items-center gap-1 rounded-[var(--radius-sm)] border border-transparent px-1 text-left text-[10px] font-[540] leading-none text-[var(--fg-soft)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
                            style={{
                              left: `calc(${(colStart / 7) * 100}% + 1.5px)`,
                              width: `calc(${((colEnd - colStart + 1) / 7) * 100}% - 3px)`,
                              top: li * RIBBON_ROW,
                              backgroundColor: tintBg,
                            }}
                          >
                            {continuesBefore && (
                              <span className="shrink-0 text-[9px]">‹</span>
                            )}
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: layerColor(e.layer) }}
                            />
                            <span className="truncate">{e.title}</span>
                            {continuesAfter && (
                              <span className="ml-auto shrink-0 text-[9px]">
                                ›
                              </span>
                            )}
                          </button>
                        );
                      },
                    ),
                  )}
              </div>
            )}
          </div>
        );
      })}

      <DayEventsDialog
        day={moreDay?.day || null}
        events={moreDay?.events || []}
        canEdit={canEdit}
        onEventClick={onEventClick}
        onNewDay={onNewDay}
        onOpenChange={() => setMoreDay(null)}
      />
    </div>
  );
}
