import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { calendarApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/filetypes';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CloudUpload,
  Download,
  FileUp,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';

const ACCEPT = '.csv,.xlsx';
const ACCEPT_EXTENSIONS = ACCEPT.split(',').map((s) => s.trim().toLowerCase());
const ACCEPT_HINT = 'CSV or XLSX';
const MAX_BYTES = 20 * 1024 * 1024;

const IMPORT_TYPES = [
  { value: 'lecture', label: 'Lecture timetable', hint: 'Academic lectures layer' },
  { value: 'exam', label: 'Exam timetable', hint: 'Exams layer' },
  { value: 'events', label: 'Institution events', hint: 'Institution layer' },
];

const LAYER_LABELS = {
  academic: 'Academic',
  exams: 'Exams',
  institution: 'Institution',
  office_hours: 'Office hours',
  personal: 'Personal',
};

const STEPS = [
  { label: 'File', hint: 'CSV or XLSX timetable' },
  { label: 'Preview', hint: 'Review parsed rows' },
  { label: 'Import', hint: 'Create calendar events' },
];

const statusTone = (status) => {
  if (status === 'confirmed') return 'bg-[var(--success)]/12 text-[var(--success)]';
  if (status === 'cancelled') return 'bg-[var(--danger)]/12 text-[var(--danger)]';
  return 'bg-[var(--info)]/12 text-[var(--info)]';
};

export default function CalendarUploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [importType, setImportType] = useState('lecture');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [done, setDone] = useState(null);

  const sourceFormat = useMemo(
    () => (file && file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv'),
    [file],
  );

  const previewMutation = useMutation({
    mutationFn: () => calendarApi.previewSchedule(file, { sourceFormat, importType }),
    onSuccess: () => setStep(1),
    onError: (e) =>
      toast.error(e.response?.data?.error?.detail || e.message || 'Could not preview the file'),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      calendarApi.commitSchedule(file, {
        title: title.trim() || undefined,
        importType,
        sourceFormat,
      }),
    onSuccess: (res) => {
      setDone(res);
      toast.success('Timetable imported');
    },
    onError: (e) =>
      toast.error(e.response?.data?.error?.detail || e.message || 'Import failed'),
  });

  const setFileWithValidation = (incoming) => {
    setFileError('');
    const f = incoming && incoming[0];
    if (!f) return;
    const dot = f.name.lastIndexOf('.');
    const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : '';
    if (ext && !ACCEPT_EXTENSIONS.includes(ext)) {
      setFileError(`“${f.name}” is not supported. Use ${ACCEPT_HINT}.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError(`File exceeds the 20 MB limit (${formatBytes(f.size)}).`);
      return;
    }
    setFile(f);
    setDone(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setFileWithValidation(Array.from(e.dataTransfer.files || []));
  };

  const downloadTemplate = async () => {
    try {
      const blob = await calendarApi.scheduleTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timetable-template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template');
    }
  };

  const back = () => {
    if (step === 1) {
      setStep(0);
      return;
    }
    if (step === 0) {
      navigate('/calendar');
    }
  };

  if (done) {
    return (
      <AppShell
        title="Timetable upload"
        description="Bulk-import schedules into the institution calendar."
      >
        <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center view-enter">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/12">
            <CheckCircle2 className="h-7 w-7 text-[var(--success)]" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-semibold">
            {done.event_count} event{done.event_count === 1 ? '' : 's'} imported
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {done.error_count > 0
              ? `The ${done.error_count} problem row${done.error_count === 1 ? ' was' : 's were'} skipped during parsing and are listed in the import log.`
              : `All rows were validated on the dry run and imported without errors.`}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <CalendarClock className="h-3 w-3" aria-hidden />
              {done.schedule_id ? 'Recorded in timetable history' : 'Imported'}
            </span>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/calendar')}
              className="h-9 gap-1.5"
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Go to calendar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDone(null);
                setFile(null);
                setTitle('');
                setStep(0);
              }}
              className="h-9 gap-1.5"
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              Upload another
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Timetable upload"
      description="Import lecture, exam, or institution event schedules as calendar events. Rows are validated on a dry run before anything is written."
      actions={
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/calendar">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to calendar
          </Link>
        </Button>
      }
    >
      {/* Stepper */}
      <ol className="mx-auto mb-5 flex max-w-3xl items-center gap-2">
        {STEPS.map((s, i) => {
          const active = i === step;
          const doneStep = i < step;
          return (
            <li key={s.label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  doneStep && 'border-[var(--success)]/50 bg-[var(--success-soft)] text-[var(--success)]',
                  active && 'border-primary/50 bg-primary/10 text-primary',
                  !doneStep && !active && 'border-border bg-muted/30 text-muted-foreground',
                )}
              >
                {doneStep ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-xs font-medium',
                    active || doneStep ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{s.hint}</p>
              </div>
              {i < STEPS.length - 1 && (
                <span className="h-px w-4 shrink-0 bg-border sm:w-8" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFileError('');
            if (!file) {
              setFileError('Choose a CSV or XLSX file first.');
              return;
            }
            previewMutation.mutate();
          }}
          className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1.4fr_1fr]"
        >
          <div className="space-y-5">
            {fileError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription className="text-xs">{fileError}</AlertDescription>
              </Alert>
            ) : null}

            {/* Dropzone / chosen file */}
            <div className="rounded-xl border bg-card p-1">
              {!file ? (
                <label
                  htmlFor="timetable-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center justify-center rounded-lg px-6 py-12 text-center transition-all',
                    'border-2 border-dashed',
                    isDragging
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border/70 hover:border-primary/40 hover:bg-accent/20',
                  )}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <UploadCloud className="h-7 w-7" aria-hidden />
                  </span>
                  <p className="mt-4 text-sm font-medium">
                    Drop your timetable here, or <span className="text-primary">click to browse</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ACCEPT_HINT} · up to 20 MB
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-[var(--success)]" aria-hidden />
                      Tenant-isolated, dry-run first
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                      No rows written until you import
                    </span>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileUp className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceFormat.toUpperCase()} · {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${file.name}`}
                    disabled={previewMutation.isPending}
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
              <input
                ref={inputRef}
                id="timetable-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  setFileWithValidation(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
            </div>

            {/* Import type + title */}
            <div className="rounded-xl border bg-card p-5">
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="import-type" className="text-xs">
                    Timetable type
                  </Label>
                  <Select value={importType} onValueChange={setImportType}>
                    <SelectTrigger id="import-type" className="h-9 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-sm">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {IMPORT_TYPES.find((t) => t.value === importType)?.hint}.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="import-title" className="text-xs">
                    Title <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="import-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      importType === 'lecture'
                        ? 'e.g. Semester 1 lecture timetable'
                        : importType === 'exam'
                          ? 'e.g. End-of-semester exams'
                          : 'e.g. Freshers week events'
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadTemplate()}
                className="h-9 gap-1.5 text-xs text-muted-foreground"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download template
              </Button>
              {previewMutation.isPending ? (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-2 text-xs"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                  Parsing file…
                </div>
              ) : (
                <Button
                  type="submit"
                  disabled={!file}
                  size="sm"
                  className="h-9 gap-2 px-5 text-xs font-medium"
                >
                  <CloudUpload className="h-3.5 w-3.5" aria-hidden />
                  Preview timetable
                </Button>
              )}
            </div>
          </div>

          {/* Right: info sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-[68px] lg:self-start">
            <div className="rounded-xl border bg-[var(--surface-2)] p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-primary dark:bg-white/10">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold">How it works</h3>
              </div>
              <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-foreground/80">
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">1</span>
                  <span>Download the CSV template to match the required columns exactly.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">2</span>
                  <span>Upload your CSV or XLSX. The server validates every row against the calendar rules.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">3</span>
                  <span>Review the preview — bad rows are skipped, never fail the whole file.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">4</span>
                  <span>Import to create the events. Nothing is written before this step.</span>
                </li>
              </ol>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <h4 className="text-xs font-semibold">Template columns</h4>
                  <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                    <li>
                      <code className="rounded bg-muted px-1">title</code>·<code className="rounded bg-muted px-1">start</code>·<code className="rounded bg-muted px-1">end</code>·<code className="rounded bg-muted px-1">layer</code> are required.
                    </li>
                    <li>
                      Optional: <code className="rounded bg-muted px-1">description</code>, <code className="rounded bg-muted px-1">location</code>, <code className="rounded bg-muted px-1">all_day</code>, <code className="rounded bg-muted px-1">status</code>.
                    </li>
                    <li>Timestamps use <code className="rounded bg-muted px-1">YYYY-MM-DD HH:MM</code>.</li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </form>
      ) : (
        /* Step 1: preview + import */
        <div className="mx-auto max-w-4xl space-y-5">
          {(previewMutation.data?.warnings?.length > 0 ||
            previewMutation.data?.row_count === 0) && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <AlertDescription className="text-xs">
                {previewMutation.data?.row_count === 0
                  ? 'No rows could be read. Check the template columns and the file contents, then retry.'
                  : `${previewMutation.data.warnings.length} row${previewMutation.data.warnings.length === 1 ? '' : 's'} skipped during validation.`}
              </AlertDescription>
            </Alert>
          )}

          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ready to import
              </p>
              <p className="mt-1.5 text-2xl font-semibold">
                {previewMutation.data?.row_count ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">validated rows</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Skipped
              </p>
              <p className="mt-1.5 text-2xl font-semibold">
                {previewMutation.data?.warnings?.length ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">problem rows</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                File
              </p>
              <p className="mt-1.5 truncate text-sm font-medium">{file?.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {IMPORT_TYPES.find((t) => t.value === importType)?.label}
              </p>
            </div>
          </div>

          {/* Rows table */}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Title</TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Start</TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">End</TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Layer</TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Location</TableHead>
                  <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previewMutation.data?.rows || []).map((row, i) => (
                  <TableRow key={`${row.title}-${row.start}-${i}`} className="h-11">
                    <TableCell className="py-2 text-sm font-medium">{row.title}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {formatDateTime(row.start)}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {row.end ? formatDateTime(row.end) : '—'}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-xs capitalize">{LAYER_LABELS[row.layer] || row.layer}</span>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {row.location || '—'}
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium capitalize',
                          statusTone(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Warnings */}
          {previewMutation.data?.warnings?.length > 0 && (
            <div className="rounded-xl border bg-[var(--surface-2)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Validation notes
              </p>
              <ul className="mt-2 space-y-1.5">
                {previewMutation.data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-hidden />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs text-muted-foreground"
              disabled={commitMutation.isPending}
              onClick={back}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Change file
            </Button>
            {commitMutation.isPending ? (
              <div role="status" className="flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                Creating events…
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-2 px-5 text-xs font-medium"
                disabled={(previewMutation.data?.row_count ?? 0) === 0}
                onClick={() => commitMutation.mutate()}
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                Import {previewMutation.data?.row_count ?? 0} event
                {(previewMutation.data?.row_count ?? 0) === 1 ? '' : 's'}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-[var(--success)]" aria-hidden />
              Writes are scoped to your institution only
            </span>
            <span className="inline-flex items-center gap-1">
              <Info className="h-3 w-3" aria-hidden />
              Importing replaces nothing — events are only added.
            </span>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}