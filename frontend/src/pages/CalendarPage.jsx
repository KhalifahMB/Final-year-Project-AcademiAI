import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
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
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { calendarApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  MapPin,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';

const VIEWS = ['month', 'week', 'day', 'agenda'];

const LAYERS = [
  { key: 'personal', label: 'Study Plans', color: 'var(--accent)' },
  { key: 'academic', label: 'Lectures', color: 'var(--info)' },
  { key: 'exams', label: 'Exams', color: 'var(--danger)' },
  { key: 'office_hours', label: 'Office Hours', color: 'var(--warn)' },
  { key: 'institution', label: 'Institution', color: 'var(--success)' },
];

const EVENT_TYPE_LABELS = {
  lecture: 'Lecture',
  exam: 'Exam',
  study: 'Study Session',
  office_hours: 'Office Hours',
  institution: 'Institution Event',
  reminder: 'Reminder',
};

const LAYER_LABELS = Object.fromEntries(LAYERS.map((l) => [l.key, l.label]));

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function layerColor(layer) {
  return LAYERS.find((l) => l.key === layer)?.color || 'var(--accent)';
}

function parseDateValue(view, base) {
  if (view === 'month') {
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  if (view === 'week') {
    return {
      start: startOfWeek(base, { weekStartsOn: 1 }),
      end: endOfWeek(base, { weekStartsOn: 1 }),
    };
  }
  if (view === 'day') {
    return { start: startOfDay(base), end: endOfDay(base) };
  }
  // agenda
  return { start: startOfDay(base), end: addDays(startOfDay(base), 30) };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(() => new Date());
  const [selectedLayers, setSelectedLayers] = useState(() =>
    Object.fromEntries(LAYERS.map((l) => [l.key, true])),
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [form, setForm] = useState(() => ({
    title: '',
    description: '',
    event_type: 'study',
    layer: 'personal',
    start: '',
    end: '',
    all_day: false,
    venue: '',
    course_code: '',
    visibility: 'private',
    reminders_minutes: [],
    notify_enabled: true,
  }));

  const range = useMemo(() => parseDateValue(view, current), [view, current]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'calendar',
      'events',
      view,
      format(range.start, 'yyyy-MM-dd'),
      format(range.end, 'yyyy-MM-dd'),
    ],
    queryFn: () =>
      calendarApi.listEventsLight({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      }),
  });

  const events = useMemo(() => data?.results || data || [], [data]);

  const visibleEvents = useMemo(
    () => events.filter((e) => selectedLayers[e.layer]),
    [events, selectedLayers],
  );

  const createMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? calendarApi.updateEvent(editing.id, payload)
        : calendarApi.createEvent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setShowCreate(false);
      setEditing(null);
      toast.success(editing ? 'Event updated' : 'Event scheduled');
    },
    onError: (e) => {
      toast.error(
        e?.response?.data?.error?.detail ||
          e?.message ||
          'Could not save event',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: calendarApi.deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setToDelete(null);
      toast.success('Event deleted');
    },
    onError: () => toast.error('Could not delete event'),
  });

  const startCreate = (day = new Date()) => {
    setShowCreate(true);
    setEditing(null);
    setForm((f) => ({ ...f, start: format(day, "yyyy-MM-dd'T'HH:mm") }));
  };

  const startEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      layer: event.layer,
      start: format(parseISO(event.start), "yyyy-MM-dd'T'HH:mm"),
      end: event.end ? format(parseISO(event.end), "yyyy-MM-dd'T'HH:mm") : '',
      all_day: event.all_day,
      venue: event.venue || '',
      course_code: event.course_code || '',
      visibility: event.visibility || 'private',
      reminders_minutes: event.reminders_minutes || [],
      notify_enabled: event.notify_enabled !== false,
    });
    setShowCreate(true);
  };

  const submit = () => {
    const startDate = new Date(form.start);
    let endDate = form.end ? new Date(form.end) : null;
    if (!endDate || endDate <= startDate) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }
    createMutation.mutate({
      title: form.title,
      description: form.description,
      event_type: form.event_type,
      layer: form.layer,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      all_day: form.all_day,
      venue: form.venue,
      course_code: form.course_code,
      visibility: form.visibility,
      reminders_minutes: form.reminders_minutes,
      notify_enabled: form.notify_enabled,
    });
  };

  const exportIcs = async () => {
    try {
      const blob = await calendarApi.exportIcs({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'academiai-calendar.ics';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Calendar exported (.ics)');
    } catch {
      toast.error('Could not export calendar');
    }
  };

  const shift = (n) => {
    if (view === 'month') setCurrent((c) => addMonths(c, n));
    else setCurrent((c) => addDays(c, n * (view === 'week' ? 7 : 1)));
  };

  const navigateDate = (day) => {
    setSelectedDate(day);
    setCurrent(day);
    setView('day');
  };

  const canEdit = (event) =>
    user?.is_superuser ||
    user?.role === 'tenant_admin' ||
    (user?.role === 'lecturer' &&
      ['personal', 'office_hours'].includes(event.layer)) ||
    (user?.role === 'student' && event.layer === 'personal');

  return (
    <AppShell
      title="Calendar"
      description="Personal study plans, academic schedules, exams, and institution events in one layered calendar."
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={exportIcs}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export ICS
          </Button>
          <Button
            size="sm"
            onClick={() => startCreate(selectedDate)}
            className="gap-1.5"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Schedule
          </Button>
        </>
      }
    >
      <div className="card-glass overflow-hidden rounded-[var(--radius-lg)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(-1)}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(1)}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="min-w-[140px] px-1 text-[15px] font-[640] tracking-tight">
            {view === 'month'
              ? format(current, 'MMMM yyyy')
              : view === 'week'
                ? `${format(startOfWeek(current, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                : format(current, 'EEEE, MMMM d, yyyy')}
          </h2>

          <div className="ml-auto flex items-center gap-1">
            <div className="flex rounded-md border border-[var(--border)] p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-[560] capitalize transition-colors',
                    view === v
                      ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--fg)]',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
          <span className="text-[11px] font-[600] uppercase tracking-wide text-[var(--muted)]">
            Layers
          </span>
          {LAYERS.map((layer) => (
            <label
              key={layer.key}
              className="flex cursor-pointer select-none items-center gap-1.5 text-[13px] text-[var(--fg)]"
            >
              <button
                type="button"
                role="switch"
                aria-checked={selectedLayers[layer.key]}
                onClick={() =>
                  setSelectedLayers((s) => ({
                    ...s,
                    [layer.key]: !s[layer.key],
                  }))
                }
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                  selectedLayers[layer.key]
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--surface-2)] border border-[var(--border)]',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                    selectedLayers[layer.key]
                      ? 'translate-x-[19px]'
                      : 'translate-x-[3px]',
                  )}
                />
              </button>
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: layer.color }}
              />
              {layer.label}
            </label>
          ))}
        </div>

        {/* Views */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[var(--muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
              calendar…
            </div>
          ) : view === 'month' ? (
            <MonthView
              current={current}
              events={visibleEvents}
              onSelectDay={(d) => {
                setSelectedDate(d);
                setCurrent(d);
              }}
              onNewDay={startCreate}
              onEventClick={startEdit}
              canEdit={canEdit}
            />
          ) : view === 'week' ? (
            <WeekView
              current={current}
              events={visibleEvents}
              onNewDay={startCreate}
              onEventClick={startEdit}
              canEdit={canEdit}
            />
          ) : view === 'day' ? (
            <DayView
              current={current}
              events={visibleEvents}
              onNewDay={startCreate}
              onEventClick={startEdit}
              canEdit={canEdit}
            />
          ) : (
            <AgendaView
              events={visibleEvents}
              onEventClick={startEdit}
              onDayClick={navigateDate}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>

      <EventDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={submit}
        user={user}
        onDelete={() => setToDelete(editing)}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete event"
        description="This event will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </AppShell>
  );
}

/* ============================ Month View ============================ */
function MonthView({
  current,
  events,
  onSelectDay,
  onNewDay,
  onEventClick,
  canEdit,
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

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => (
          <div
            key={h}
            className="py-2 text-center text-[11px] font-[600] uppercase tracking-wide text-[var(--muted)]"
          >
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((e) =>
            e.all_day
              ? isSameDay(parseISO(e.start), day)
              : isSameDay(parseISO(e.start), day),
          );
          const inMonth = isSameMonth(day, current);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'group min-h-[96px] cursor-pointer border-b border-r border-[var(--border)] p-1 transition-colors hover:bg-[var(--hover)] last:border-r-0',
                !inMonth && 'text-[var(--muted)] bg-[var(--surface)]/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-[560]',
                    today && 'bg-[var(--accent)] text-[var(--on-accent)]',
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
                  className="opacity-0 group-hover:opacity-100 rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  aria-label="Add event"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (canEdit(e)) onEventClick(e);
                    }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight text-[var(--on-accent)]/90 hover:brightness-95"
                    style={{
                      backgroundColor: layerColor(e.layer),
                      opacity: e.status === 'cancelled' ? 0.5 : 1,
                    }}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-[11px] font-[560] text-[var(--muted)]">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ Week View ============================ */
function WeekView({ current, events, onNewDay, onEventClick, canEdit }) {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="grid grid-cols-8 border-b border-[var(--border)]">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          const dayEvents = events.filter((e) =>
            isSameDay(parseISO(e.start), d),
          );
          return (
            <div
              key={d.toISOString()}
              className="flex flex-col items-center gap-1 py-2"
            >
              <span className="text-[10px] font-[560] uppercase text-[var(--muted)]">
                {format(d, 'EEE')}
              </span>
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-[640]',
                  today && 'bg-[var(--accent)] text-[var(--on-accent)]',
                )}
              >
                {format(d, 'd')}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5 px-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-4 rounded-full"
                    style={{ backgroundColor: layerColor(e.layer) }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-8">
        <div className="border-r border-[var(--border)] bg-[var(--surface)]/30">
          {HOURS.map((h) => (
            <div
              key={h}
              className="relative h-14 border-b border-[var(--border)] pr-1 text-right align-top"
            >
              <span className="absolute -top-1.5 right-1 text-[10px] text-[var(--muted)]">
                {h === 0
                  ? '12am'
                  : h < 12
                    ? `${h}am`
                    : h === 12
                      ? '12pm'
                      : `${h - 12}pm`}
              </span>
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayEvents = events.filter((e) =>
            isSameDay(parseISO(e.start), d),
          );
          return (
            <div
              key={d.toISOString()}
              className="relative border-r border-[var(--border)] last:border-r-0"
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="h-14 border-b border-[var(--border)] hover:bg-[var(--hover)]"
                  onClick={() => {
                    const dt = new Date(d);
                    dt.setHours(h, 0, 0, 0);
                    onNewDay(dt);
                  }}
                />
              ))}
              {dayEvents
                .filter((e) => !e.all_day)
                .map((e) => {
                  const s = parseISO(e.start);
                  const mins = s.getHours() * 60 + s.getMinutes();
                  const dur = e.duration_minutes || 60;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => canEdit(e) && onEventClick(e)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded px-1.5 py-0.5 text-left text-[10px] leading-tight text-[var(--on-accent)]/90"
                      style={{
                        top: `${(mins / 60) * 56}px`,
                        height: `${Math.max((dur / 60) * 56 - 2, 18)}px`,
                        backgroundColor: layerColor(e.layer),
                      }}
                    >
                      {e.title}
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

/* ============================ Day View ============================ */
function DayView({ current, events, onNewDay, onEventClick, canEdit }) {
  const dayEvents = events
    .filter((e) => isSameDay(parseISO(e.start), current))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-[15px] font-[640]">
          {format(current, 'EEEE, MMMM d, yyyy')}
        </h3>
        <div className="flex gap-1.5">
          {dayEvents.map((e) => (
            <span
              key={e.id}
              className="inline-block h-2.5 w-5 rounded-full"
              style={{ backgroundColor: layerColor(e.layer) }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[80px_1fr]">
        <div className="border-r border-[var(--border)] bg-[var(--surface)]/30">
          {HOURS.map((h) => (
            <div
              key={h}
              className="relative h-14 border-b border-[var(--border)] pr-1 text-right align-top"
            >
              <span className="absolute -top-1.5 right-1 text-[10px] text-[var(--muted)]">
                {h === 0
                  ? '12am'
                  : h < 12
                    ? `${h}am`
                    : h === 12
                      ? '12pm'
                      : `${h - 12}pm`}
              </span>
            </div>
          ))}
        </div>
        <div className="relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-14 border-b border-[var(--border)] hover:bg-[var(--hover)]"
              onClick={() => {
                const dt = new Date(current);
                dt.setHours(h, 0, 0, 0);
                onNewDay(dt);
              }}
            />
          ))}
          {dayEvents
            .filter((e) => !e.all_day)
            .map((e) => {
              const s = parseISO(e.start);
              const mins = s.getHours() * 60 + s.getMinutes();
              const dur = e.duration_minutes || 60;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => canEdit(e) && onEventClick(e)}
                  className="absolute left-0 right-0 mx-1 overflow-hidden rounded px-2 py-1 text-left text-[11px] leading-tight text-[var(--on-accent)]/90"
                  style={{
                    top: `${(mins / 60) * 56}px`,
                    height: `${Math.max((dur / 60) * 56 - 2, 22)}px`,
                    backgroundColor: layerColor(e.layer),
                  }}
                >
                  <span className="font-[620]">{e.title}</span>
                  {e.venue && (
                    <div className="flex items-center gap-0.5 opacity-80">
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

/* ============================ Agenda View ============================ */
function AgendaView({ events, onEventClick, onDayClick, canEdit }) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start) - new Date(b.start),
  );
  if (sorted.length === 0) {
    return (
      <div className="py-16">
        <EmptyState
          icon={<CalendarRange className="h-8 w-8" />}
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
            className="mb-2 flex items-baseline gap-2 text-left hover:text-[var(--accent)]"
          >
            <span className="text-[14px] font-[640]">
              {format(parseISO(day), 'EEEE, MMMM d')}
            </span>
            <span className="text-[12px] text-[var(--muted)]">
              {dayEvents.length} events
            </span>
          </button>
          <div className="space-y-1.5">
            {dayEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => canEdit(e) && onEventClick(e)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/60 p-2.5 text-left transition-colors hover:bg-[var(--hover)]"
              >
                <span
                  className="inline-block h-full min-h-[34px] w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: layerColor(e.layer) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-[600]">{e.title}</p>
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
                    <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[10px] font-[550] uppercase tracking-wide">
                      {LAYER_LABELS[e.layer] || e.layer}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ Event Dialog ============================ */
function EventDialog({
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
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Linear Algebra revision"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Layer</Label>
              <Select
                value={form.layer}
                onValueChange={(v) => setForm((f) => ({ ...f, layer: v }))}
              >
                <SelectTrigger>
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
              <Label>Event type</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}
              >
                <SelectTrigger>
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
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={form.start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
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
              <Label>Venue</Label>
              <Input
                value={form.venue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, venue: e.target.value }))
                }
                placeholder="Room, building, online link…"
              />
            </div>
            <div>
              <Label>Course code</Label>
              <Input
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
