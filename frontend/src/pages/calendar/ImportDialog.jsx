import { useState } from 'react';
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
import { calendarApi } from '@/services/api';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarRange,
  Download,
  Loader2,
  Upload,
} from 'lucide-react';

export default function ImportDialog({
  open,
  onOpenChange,
  onRefetch,
  onTemplate,
}) {
  const [importType, setImportType] = useState('lecture');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setLoading(false);
    setCommitting(false);
  };

  const handleClose = (next) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const runPreview = async () => {
    if (!file) return;
    setLoading(true);
    setPreview(null);
    try {
      const result = await calendarApi.previewSchedule(file, { importType });
      setPreview(result);
    } catch (e) {
      toast.error(
        e?.response?.data?.error?.detail || e?.message || 'Could not read file',
      );
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setCommitting(true);
    try {
      const result = await calendarApi.commitSchedule(file, {
        importType,
        title: `Imported ${importType} timetable`,
      });
      toast.success(
        `Imported ${result.event_count} event${result.event_count === 1 ? '' : 's'}` +
          (result.error_count ? ` · ${result.error_count} row(s) skipped` : ''),
      );
      onRefetch();
      handleClose(false);
    } catch (e) {
      toast.error(
        e?.response?.data?.error?.detail || e?.message || 'Import failed',
      );
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import timetable</DialogTitle>
          <DialogDescription>
            Upload a CSV timetable (title, start, end, layer). Rows with
            missing or invalid values are skipped and reported so you can fix
            and re-upload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Import type</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">Lecture timetable</SelectItem>
                  <SelectItem value="exam">Exam timetable</SelectItem>
                  <SelectItem value="events">Institution events</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={onTemplate} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download CSV template
              </Button>
            </div>
          </div>

          <div>
            <Label>CSV file</Label>
            <Input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                setPreview(null);
              }}
            />
          </div>

          {preview && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <span className="text-[13px] font-[600] text-[var(--fg)]">
                  Preview
                </span>
                <span className="text-[12px] text-[var(--muted)]">
                  {preview.row_count} valid row{preview.row_count === 1 ? '' : 's'}
                  {preview.warnings.length > 0 &&
                    ` · ${preview.warnings.length} skipped`}
                </span>
              </div>
              {preview.warnings.length > 0 && (
                <div className="max-h-28 space-y-1 overflow-y-auto border-b border-[var(--border)] bg-[var(--warn-soft)]/40 px-3 py-2">
                  {preview.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="flex items-start gap-1.5 text-[12px] text-[var(--fg-soft)]"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warn)]" />
                      {w}
                    </p>
                  ))}
                </div>
              )}
              {preview.rows.length > 0 ? (
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-1.5 font-[560]">Title</th>
                        <th className="px-3 py-1.5 font-[560]">Layer</th>
                        <th className="px-3 py-1.5 font-[560]">Start</th>
                        <th className="px-3 py-1.5 font-[560]">End</th>
                        <th className="px-3 py-1.5 font-[560]">Venue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {preview.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-[var(--fg)]">
                            {r.title}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--muted)]">
                            {r.layer}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--muted)]">
                            {r.start?.replace('T', ' ').slice(0, 16) || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--muted)]">
                            {r.end?.replace('T', ' ').slice(0, 16) || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--muted)]">
                            {r.venue || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-3 py-3 text-[12px] text-[var(--muted)]">
                  No valid rows to import — fix the flagged rows and re-upload.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runPreview}
            disabled={!file || loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarRange className="h-3.5 w-3.5" />
            )}
            Preview
          </Button>
          <Button
            size="sm"
            onClick={commit}
            disabled={!file || committing || preview?.row_count === 0}
            className="gap-1.5"
          >
            {committing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Import {preview?.row_count ? `${preview.row_count} events` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
