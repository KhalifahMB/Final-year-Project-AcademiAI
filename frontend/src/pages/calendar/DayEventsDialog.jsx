import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Plus, Tag } from 'lucide-react';
import { LAYER_LABELS } from './constants';
import { layerColor } from './utils';

export default function DayEventsDialog({
  day,
  events,
  canEdit,
  onEventClick,
  onNewDay,
  onOpenChange,
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start) - new Date(b.start),
  );
  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onOpenChange()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {day ? format(day, 'EEEE, MMMM d') : 'Day'}
          </DialogTitle>
          <DialogDescription>
            {sorted.length} event{sorted.length === 1 ? '' : 's'} on this day
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {sorted.map((e) => (
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
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onOpenChange}>
            Close
          </Button>
          {day && (
            <Button size="sm" onClick={() => onNewDay(day)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New event
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
