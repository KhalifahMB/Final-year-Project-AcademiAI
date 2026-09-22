import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { EVENT_TYPE_LABELS } from './constants';

export default function EventDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSubmit,
  user,
  onDelete,
}) {
  const isAdmin = user?.role === 'tenant_admin' || user?.is_superuser;
  const isLecturer = user?.role === 'lecturer';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'Schedule'}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Create an event on any calendar layer, including institution-wide events.'
              : isLecturer
                ? 'Create a personal event or office hours.'
                : 'Schedule a study session for a day. This syncs to your AI agent.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="evt-title">Title</Label>
            <Input
              id="evt-title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Linear Algebra revision"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="evt-layer">Layer</Label>
              <Select
                value={form.layer}
                onValueChange={(v) => setForm((f) => ({ ...f, layer: v }))}
              >
                <SelectTrigger id="evt-layer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Study Plans</SelectItem>
                  <SelectItem
                    value="office_hours"
                    disabled={!isLecturer && !isAdmin}
                  >
                    Office Hours
                  </SelectItem>
                  <SelectItem value="institution" disabled={!isAdmin}>
                    Institution Event
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="evt-type">Event type</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}
              >
                <SelectTrigger id="evt-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="evt-start">Start</Label>
              <Input
                id="evt-start"
                type="datetime-local"
                value={form.start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="evt-end">End</Label>
              <Input
                id="evt-end"
                type="datetime-local"
                value={form.end}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="evt-venue">Venue</Label>
              <Input
                id="evt-venue"
                value={form.venue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, venue: e.target.value }))
                }
                placeholder="Room, building, online link…"
              />
            </div>
            <div>
              <Label htmlFor="evt-course">Course code</Label>
              <Input
                id="evt-course"
                value={form.course_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, course_code: e.target.value }))
                }
                placeholder="e.g. MAT101"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, all_day: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                All day
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.notify_enabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notify_enabled: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Notifications
              </label>
            </div>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-[var(--danger)]"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>

          <div>
            <Label>Reminders</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0, 10, 30, 60, 1440].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={form.reminders_minutes.includes(m)}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      reminders_minutes: f.reminders_minutes.includes(m)
                        ? f.reminders_minutes.filter((x) => x !== m)
                        : [...f.reminders_minutes, m].sort((a, b) => a - b),
                    }))
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                    form.reminders_minutes.includes(m)
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]',
                  )}
                >
                  {m === 0
                    ? 'At time'
                    : m === 60
                      ? '1 hr'
                      : m === 1440
                        ? '1 day'
                        : `${m} min`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.title.trim()}>
            {editing ? 'Save changes' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
