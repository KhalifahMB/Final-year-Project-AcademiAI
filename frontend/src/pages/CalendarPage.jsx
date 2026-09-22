import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { calendarApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import { invalidatePlannerCaches } from '@/lib/plannerSync';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  ListFilter,
  Loader2,
  Upload,
} from 'lucide-react';
import { LAYERS, VIEWS } from './calendar/constants';
import { parseDateValue } from './calendar/utils';
import MonthView from './calendar/MonthView';
import MonthStrip from './calendar/MonthStrip';
import WeekView from './calendar/WeekView';
import DayView from './calendar/DayView';
import AgendaView from './calendar/AgendaView';
import EventHoverCard from './calendar/EventHoverCard';
import UpcomingPanel from './calendar/UpcomingPanel';
import EventDialog from './calendar/EventDialog';
import ImportDialog from './calendar/ImportDialog';

export default function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(() => new Date());
  const [selectedLayers, setSelectedLayers] = useState(() =>
    Object.fromEntries(LAYERS.map((l) => [l.key, true])),
  );
  const layersApplied = useRef(false);
  const [showImport, setShowImport] = useState(false);
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
  const [eventsOnly, setEventsOnly] = useState(false);
  const [hoverEvent, setHoverEvent] = useState(null);
  const hoverClearTimer = useRef(null);
  const bindHover = (e) => ({
    onMouseEnter: (ev) => {
      clearTimeout(hoverClearTimer.current);
      const r = ev.currentTarget.getBoundingClientRect();
      setHoverEvent({
        event: e,
        rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width },
      });
    },
    onMouseLeave: () => {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = setTimeout(() => setHoverEvent(null), 90);
    },
  });

  const range = useMemo(() => parseDateValue(view, current), [view, current]);

  const { data: layerData } = useQuery({
    queryKey: ['calendar', 'layers'],
    queryFn: () => calendarApi.layers(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (layersApplied.current || !layerData?.default_layers?.length) return;
    layersApplied.current = true;
    setSelectedLayers((prev) => {
      const next = { ...prev };
      for (const l of LAYERS) {
        next[l.key] = layerData.default_layers.includes(l.key);
      }
      return next;
    });
  }, [layerData]);

  const { data, isLoading, isError, refetch } = useQuery({
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
      invalidatePlannerCaches(qc);
      qc.invalidateQueries({ queryKey: ['calendar', 'upcoming'] });
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
      invalidatePlannerCaches(qc);
      qc.invalidateQueries({ queryKey: ['calendar', 'upcoming'] });
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

  const isAdmin = user?.role === 'tenant_admin' || user?.is_superuser;

  const downloadTemplate = async () => {
    try {
      const blob = await calendarApi.scheduleTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timetable-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download template');
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
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImport(true)}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Import timetable
            </Button>
          )}
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
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-3">
          {/* Nav group: ‹ Today › */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(-1)}
              aria-label="Previous"
              className="h-8 w-8 rounded-l-md rounded-r-none border border-r-0 border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent(new Date())}
              className="h-8 rounded-none border-y border-[var(--border)] px-3 text-[12.5px] font-[560] text-[var(--fg-soft)] hover:bg-[var(--hover)]"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(1)}
              aria-label="Next"
              className="h-8 w-8 rounded-r-md rounded-l-none border border-l-0 border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="min-w-[150px] px-1 text-[17px] font-[650] tracking-tight text-[var(--fg)]">
            {view === 'month'
              ? format(current, 'MMMM yyyy')
              : view === 'week'
                ? `${format(startOfWeek(current, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                : format(current, 'EEEE, MMMM d, yyyy')}
          </h2>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* View switcher */}
            <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--surface-2)] p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-[560] capitalize transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    view === v
                      ? 'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)] shadow-sm'
                      : 'border border-transparent text-[var(--muted)] hover:text-[var(--fg)]',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            {view === 'month' && (
              <Button
                size="sm"
                variant={eventsOnly ? 'outline' : 'ghost'}
                onClick={() => setEventsOnly((v) => !v)}
                className="gap-1.5"
                aria-pressed={eventsOnly}
              >
                <ListFilter className="h-3.5 w-3.5" /> Events only
              </Button>
            )}

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
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
          {LAYERS.map((layer) => {
            const on = selectedLayers[layer.key];
            const count = events.filter((e) => e.layer === layer.key).length;
            return (
              <button
                key={layer.key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() =>
                  setSelectedLayers((s) => ({
                    ...s,
                    [layer.key]: !s[layer.key],
                  }))
                }
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-[560] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  on
                    ? 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg-soft)]',
                )}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
                {layer.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'num text-[10.5px]',
                      on ? 'text-[var(--muted)]' : 'text-[var(--faint)]',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Views */}
        <div
          className={cn(
            'min-w-0',
            view === 'month' && 'xl:grid xl:grid-cols-[minmax(0,1fr)_300px]',
          )}
        >
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[var(--muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                calendar…
              </div>
            ) : isError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Calendar could not be loaded"
                description="Check your connection and try again."
                action="Retry"
                onAction={() => refetch()}
              />
            ) : view === 'month' && eventsOnly ? (
              <MonthStrip
                current={current}
                selectedDate={selectedDate}
                events={visibleEvents}
                onSelectDay={(d) => {
                  setSelectedDate(d);
                  setCurrent(d);
                }}
                onNewDay={startCreate}
                onEventClick={startEdit}
                canEdit={canEdit}
                bindHover={bindHover}
              />
            ) : view === 'month' ? (
              <MonthView
                current={current}
                selectedDate={selectedDate}
                events={visibleEvents}
                onSelectDay={(d) => {
                  setSelectedDate(d);
                  setCurrent(d);
                }}
                onNewDay={startCreate}
                onEventClick={startEdit}
                canEdit={canEdit}
                bindHover={bindHover}
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
          {view === 'month' && !isLoading && (
            <div className="hidden border-l border-[var(--border)] xl:block">
              <UpcomingPanel
                layers={selectedLayers}
                onEventClick={startEdit}
                canEdit={canEdit}
                onNewDay={startCreate}
                bindHover={bindHover}
              />
            </div>
          )}
        </div>

        {hoverEvent && (
          <EventHoverCard
            event={hoverEvent.event}
            rect={hoverEvent.rect}
          />
        )}
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
      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onRefetch={() => {
          qc.invalidateQueries({ queryKey: ['calendar', 'events'] });
          qc.invalidateQueries({ queryKey: ['calendar', 'upcoming'] });
        }}
        onTemplate={downloadTemplate}
      />
    </AppShell>
  );
}
