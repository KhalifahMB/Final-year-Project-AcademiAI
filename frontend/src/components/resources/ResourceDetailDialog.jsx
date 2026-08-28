import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Download,
  FilePenLine,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResourceDetailDialog({ resource, open, onClose, onUpdate }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editScope, setEditScope] = useState('');
  const [saving, setSaving] = useState(false);

  // AI Summary state
  const [summaryJobId, setSummaryJobId] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (open) {
      setExpanded(false);
      setEditing(false);
      setSummaryJobId(null);
      setSummaryLoading(false);
      setSummaryResult(null);
      setSummaryError('');
      setShowSummary(false);
      // Prevent body scroll while the modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, resource?.id]);

  // ESC closes dialog (or exits expanded mode)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (expanded) setExpanded(false);
        else onClose();
        e.preventDefault();
      }
      if (e.key === 'f' || e.key === 'F') {
        setExpanded((v) => !v);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, expanded, onClose]);

  // When entering expanded/focus mode, ask the AppShell to auto-collapse the
  // desktop sidebar so reading space is maximised. (User requirement:
  // "sidebar should auto close when the screen is expanded.")
  useEffect(() => {
    if (!open) return;
    if (expanded && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('academiai:request-sidebar', { detail: { collapsed: true } }));
    }
  }, [expanded, open]);

  // Poll summary job
  useEffect(() => {
    if (!summaryJobId || !open) return;
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      try {
        const { data } = await api.get(`/jobs/${summaryJobId}/`);
        if (cancelled) return;
        if (data.ready) {
          setSummaryLoading(false);
          setSummaryJobId(null);
          if (data.successful) {
            const r = data.result || {};
            if (r.status === 'failed' || r.error) {
              setSummaryError(r.error || 'Summary failed.');
              toast.error(r.error || 'Summary failed');
            } else {
              const normalized =
                typeof r === 'string'
                  ? { summary: r, key_points: [] }
                  : { key_points: [], ...r };
              setSummaryResult(normalized);
              setShowSummary(true);
              toast.success('Summary ready');
            }
          } else {
            setSummaryError(data.error || 'Summary failed.');
            toast.error(data.error || 'Summary failed');
          }
          return;
        }
        timer = setTimeout(tick, 1500);
      } catch (err) {
        if (cancelled) return;
        setSummaryLoading(false);
        setSummaryJobId(null);
        const msg =
          err.response?.data?.error?.detail ||
          err.message ||
          'Could not poll summary job';
        setSummaryError(msg);
        toast.error(msg);
      }
    };
    timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [summaryJobId, open]);

  const requestSummary = async () => {
    setSummaryError('');
    setSummaryResult(null);
    setSummaryLoading(true);
    try {
      const { data } = await api.post(`/resources/${resource.id}/summarize/`, {});
      setSummaryJobId(data.job_id);
    } catch (err) {
      setSummaryLoading(false);
      const msg =
        err.response?.data?.error?.detail ||
        err.message ||
        'Could not start summary';
      setSummaryError(msg);
      toast.error(msg);
    }
  };

  const isOwnerOrAdmin =
    !!user &&
    !!resource &&
    (user.role === 'admin' ||
      user.is_superuser ||
      resource.uploaded_by === user.id);

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['resource-preview', resource?.id],
    queryFn: async () => {
      const { data } = await api.get(`/resources/${resource.id}/preview/`);
      return data;
    },
    enabled: open && !!resource,
  });

  const { data: bookmarks } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const { data } = await api.get('/bookmarks/?page_size=100');
      return data.results || data;
    },
    enabled: open,
  });

  const bookmarkIdFromData =
    bookmarks && resource
      ? bookmarks.find((b) => b.resource === resource.id)?.id || null
      : null;

  if (!resource || !open) return null;

  const toggleBookmark = async () => {
    try {
      if (bookmarkIdFromData) {
        await api.delete(`/bookmarks/${bookmarkIdFromData}/`);
        toast.success('Bookmark removed');
      } else {
        await api.post('/bookmarks/', { resource: resource.id });
        toast.success('Material bookmarked');
      }
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    } catch {
      toast.error('Could not update bookmark');
    }
  };

  const download = async () => {
    try {
      const { data } = await api.get(`/resources/${resource.id}/download_url/`);
      window.open(data.download_url, '_blank', 'noopener');
    } catch {
      toast.error('Could not start the download');
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await api.post(`/resources/${resource.id}/retry_processing/`);
      toast.success('Reprocessing started');
      qc.invalidateQueries({ queryKey: ['resources'] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const startEdit = () => {
    setEditTitle(resource.title || '');
    setEditDesc(resource.description || '');
    setEditScope(resource.visibility_scope || 'course');
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/resources/${resource.id}/`, {
        title: editTitle,
        description: editDesc,
        visibility_scope: editScope,
      });
      toast.success('Resource updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['resources'] });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async () => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.delete(`/resources/${resource.id}/`);
      toast.success('Resource deleted');
      qc.invalidateQueries({ queryKey: ['resources'] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Delete failed');
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Resource: ${resource.title}`}
    >
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/95 px-3 shadow-sm backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to resources"
            title="Back"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold sm:text-base">
              {resource.title}
            </h2>
            <div className="flex items-center gap-2 pt-0.5">
              <StatusBadge status={resource.processing_status} />
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                {resource.visibility_scope}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Exit focus mode' : 'Focus mode (hide panel)'}
            aria-label={expanded ? 'Exit focus mode' : 'Focus mode'}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* AI Summary panel */}
        {showSummary && summaryResult && (
          <div className="shrink-0 border-b bg-gradient-to-br from-indigo-50 to-purple-50 p-4 dark:from-indigo-950/40 dark:to-purple-950/40 sm:p-6">
            <div className="mx-auto flex max-w-3xl items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">AI Summary</h3>
                  <button
                    type="button"
                    onClick={() => setShowSummary(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Dismiss summary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="prose prose-sm mt-2 max-w-none text-[14px] leading-relaxed dark:prose-invert">
                  <ReactMarkdown>
                    {summaryResult.summary || 'No summary text returned.'}
                  </ReactMarkdown>
                </div>
                {Array.isArray(summaryResult.key_points) &&
                  summaryResult.key_points.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Key points
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {summaryResult.key_points.map((kp, i) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
        {summaryLoading && (
          <div className="shrink-0 border-b bg-primary/5 px-5 py-3">
            <div className="mx-auto flex max-w-3xl items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Generating AI summary… this takes a few seconds.
            </div>
          </div>
        )}
        {summaryError && !summaryLoading && (
          <div className="shrink-0 border-b bg-red-500/10 px-5 py-2.5 text-sm text-red-700 dark:text-red-400">
            {summaryError}
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Preview */}
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              expanded ? '' : 'border-r',
            )}
          >
            <div className="min-h-0 flex-1 overflow-hidden bg-muted/20">
              {resource.processing_status === 'failed' ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
                  <Alert variant="destructive" className="max-w-md">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">Processing failed.</span>{' '}
                      {resource.processing_error ||
                        'The file could not be processed.'}
                    </AlertDescription>
                  </Alert>
                  {isOwnerOrAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={retry}
                      disabled={retrying}
                      className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                    >
                      <RefreshCw
                        className={cn(
                          'mr-2 h-4 w-4',
                          retrying && 'animate-spin',
                        )}
                        aria-hidden
                      />
                      {retrying ? 'Restarting…' : 'Retry processing'}
                    </Button>
                  )}
                </div>
              ) : resource.processing_status !== 'ready' ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2
                    className="h-4 w-4 animate-spin text-primary"
                    aria-hidden
                  />
                  This material is {resource.processing_status}. Preview
                  unlocks when processing completes.
                </div>
              ) : previewLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{' '}
                  Loading preview…
                </div>
              ) : previewError ? (
                <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
                  Could not load the preview.
                </div>
              ) : preview?.kind === 'text' ? (
                <pre className="h-full overflow-auto whitespace-pre-wrap p-6 text-[13px] leading-relaxed">
                  {preview.content}
                  {preview.truncated
                    ? '\n\n… (truncated at 512 KB — download for full file)'
                    : ''}
                </pre>
              ) : preview?.kind === 'pdf' ? (
                <iframe
                  src={preview.preview_url}
                  title={`Preview of ${resource.title}`}
                  className="h-full w-full bg-background"
                />
              ) : preview?.kind === 'image' ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  <img
                    src={preview.preview_url}
                    alt={`Preview of ${resource.title}`}
                    className="max-h-full max-w-full rounded-md object-contain shadow-sm"
                  />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <p>
                    {preview?.detail ||
                      'Preview is not available for this file type.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={download}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden /> Download
                    file
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Side actions panel */}
          {!expanded && (
            <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l bg-card/50 p-4">
              {editing ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Edit Resource
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Title
                    </label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Visibility
                    </label>
                    <select
                      value={editScope}
                      onChange={(e) => setEditScope(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <option value="private">Private</option>
                      <option value="course">Course</option>
                      <option value="programme">Programme</option>
                      <option value="department">Department</option>
                      <option value="faculty">Faculty</option>
                      <option value="institution">Institution</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </p>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full justify-start"
                      onClick={download}
                    >
                      <Download className="mr-2 h-4 w-4" aria-hidden /> Download
                    </Button>
                    {resource.processing_status === 'ready' &&
                      resource.has_extractable_text !== false && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="w-full justify-start bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
                          onClick={requestSummary}
                          disabled={summaryLoading}
                        >
                          {summaryLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                          )}
                          {summaryLoading
                            ? 'Summarizing…'
                            : summaryResult
                              ? 'Regenerate AI summary'
                              : 'Summarize with AI'}
                        </Button>
                      )}
                    {summaryResult && !summaryLoading && (
                      <Button
                        type="button"
                        size="sm"
                        variant={showSummary ? 'secondary' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => setShowSummary((v) => !v)}
                      >
                        {showSummary ? 'Hide summary' : 'Show summary'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        bookmarkIdFromData ? 'secondary' : 'outline'
                      }
                      className="w-full justify-start"
                      onClick={toggleBookmark}
                    >
                      {bookmarkIdFromData ? (
                        <BookmarkCheck
                          className="mr-2 h-4 w-4 text-primary"
                          aria-hidden
                        />
                      ) : (
                        <Bookmark className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {bookmarkIdFromData ? 'Bookmarked' : 'Bookmark'}
                    </Button>
                  </div>

                  {isOwnerOrAdmin && (
                    <>
                      <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Manage
                      </p>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={startEdit}
                        >
                          <FilePenLine className="mr-2 h-4 w-4" aria-hidden />{' '}
                          Edit details
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="w-full justify-start"
                          onClick={deleteResource}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete
                        </Button>
                      </div>
                    </>
                  )}

                  {resource.has_extractable_text === false && (
                    <Alert className="mt-2">
                      <AlertDescription className="text-xs">
                        This material contains no extractable text (binary/OCR
                        content). It is available for preview and download but
                        cannot be summarized or searched.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );

  // Render via a Portal attached directly to document.body so z-index and
  // stacking contexts (e.g. animated parents, sticky headers, backdrops)
  // can never cover the modal. This also guarantees the fixed inset covers
  // the sidebar, header, and any other chrome regardless of where the
  // component is mounted in the React tree.
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
