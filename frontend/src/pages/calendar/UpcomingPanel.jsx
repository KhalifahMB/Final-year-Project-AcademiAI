import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { EmptyCalendarIllustration } from '@/components/shared/illustrations';
import { calendarApi } from '@/services/api';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { MS_PER_DAY, UPCOMING_LIMIT, UPCOMING_PAGE_SIZE } from './constants';
import { layerColor, layerTint } from './utils';

export default function UpcomingPanel({
  layers,
  onEventClick,
  canEdit,
  onNewDay,
  bindHover,
}) {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['calendar', 'upcoming', UPCOMING_LIMIT],
    queryFn: () => calendarApi.upcoming(UPCOMING_LIMIT),
    staleTime: 60 * 1000,
  });

  const all = (data || []).filter((e) => layers[e.layer]);
  const pageCount = Math.max(1, Math.ceil(all.length / UPCOMING_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEvents = all.slice(
    safePage * UPCOMING_PAGE_SIZE,
    safePage * UPCOMING_PAGE_SIZE + UPCOMING_PAGE_SIZE,
  );

  const now = new Date();
  const todayStart = startOfDay(now);

  const groups = [];
  for (const e of pageEvents) {
    const diff = Math.round(
      (startOfDay(parseISO(e.start)) - todayStart) / MS_PER_DAY,
    );
    const label =
      diff === 0
        ? 'Today'
        : diff === 1
          ? 'Tomorrow'
          : diff < 7
            ? 'This week'
            : format(parseISO(e.start), 'EEEE, MMM d');
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(e);
    else groups.push([label, [e]]);
  }

  const from = all.length === 0 ? 0 : safePage * UPCOMING_PAGE_SIZE + 1;
  const to = Math.min(all.length, (safePage + 1) * UPCOMING_PAGE_SIZE);

  return (
    <aside className="hidden min-w-0 xl:block">
      <div className="flex h-full max-h-[70vh] flex-col">
        <div className="flex items-baseline justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-[13px] font-[640] text-[var(--fg)]">
            Upcoming
          </h3>
          <span className="num text-[11px] text-[var(--muted)]">
            {all.length} event{all.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[var(--muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Upcoming unavailable"
              description="We could not load your upcoming events."
              action="Retry"
              onAction={() => refetch()}
            />
          ) : groups.length === 0 ? (
            <EmptyState
              illustration={EmptyCalendarIllustration}
              title="Open ahead"
              description="Nothing scheduled from today. Use the grid to plan your week."
            />
          ) : (
            <div className="space-y-4">
              {groups.map(([label, evs]) => (
                <div key={label}>
                  <p className="mb-1.5 text-[10px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {label}
                  </p>
                  <div className="space-y-0.5">
                    {evs.map((e) => {
                      const [tintBg] = layerTint(e.layer);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => canEdit(e) && onEventClick(e)}
                          {...bindHover(e)}
                          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--hover)]"
                        >
                          <span
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                            style={{ backgroundColor: tintBg }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: layerColor(e.layer) }}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-[560] text-[var(--fg)]">
                              {e.title}
                            </span>
                            <span className="block truncate text-[10.5px] text-[var(--muted)]">
                              <span className="num">
                                {format(parseISO(e.start), 'h:mm a')}
                                {e.end
                                  ? ` – ${format(parseISO(e.end), 'h:mm a')}`
                                  : ''}
                              </span>
                              {e.venue ? ` · ${e.venue}` : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {all.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px]"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="num text-[11px] text-[var(--muted)]">
                {from}–{to} of {all.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[12px]"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <div className="border-t border-[var(--border)] p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1.5"
            onClick={() => onNewDay(todayStart)}
          >
            <Plus className="h-3.5 w-3.5" /> Schedule
          </Button>
        </div>
      </div>
    </aside>
  );
}
