import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SummaryPanel from '@/components/resources/SummaryPanel';
import ResourceSidePanel from '@/components/resources/ResourceSidePanel';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { getFileType, SCOPE_META } from '@/lib/filetypes';
import {
  ArrowLeft,
  BookmarkCheck,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useReadingPosition } from '@/hooks/useReadingPosition';

const SUMMARIES_QUERY_KEY = (resourceId) => ['resource-summaries', resourceId];
const EPHEMERAL_PREFIX = 'ephemeral-';

function normalizeJobResult(r) {
  if (!r || typeof r !== 'object') return null;
  if (r.status === 'failed' || r.error) return null;
  const summary =
    (typeof r.summary === 'string' && r.summary) ||
    (typeof r === 'string' ? r : '') ||
    '';
  if (!summary) return null;
  const kp = Array.isArray(r.key_points) ? r.key_points : [];
  return {
    id: r.summary_id ? `${r.summary_id}` : `${EPHEMERAL_PREFIX}${Date.now()}`,
    summary,
    key_points: kp,
    created_at: new Date().toISOString(),
    created_by_name: null,
    ephemeral: !r.summary_id,
  };
}

export default function ResourceDetailDialog({ resource: resourceProp, open, onClose, onUpdate }) {
  const qc = useQueryClient();

  // If only a resource ID is provided (e.g. from a chat citation), fetch
  // the full resource payload so the dialog can render correctly.
  const needsFetch = open && resourceProp && resourceProp.id && !resourceProp.title;
  const { data: fetchedResource, isLoading: fetchingResource } = useQuery({
    queryKey: ['resource-by-id', resourceProp?.id],
    queryFn: async () => {
      if (!resourceProp?.id) return null;
      const { data } = await api.get(`/resources/${resourceProp.id}/`);
      return data || null;
    },
    enabled: !!needsFetch,
    staleTime: 30_000,
  });

  // Resolve which resource object to render (full object preferred, fetched fallback).
  const resource = useMemo(() => {
    if (resourceProp && resourceProp.title) return resourceProp;
    if (needsFetch && fetchedResource) return fetchedResource;
    return resourceProp;
  }, [resourceProp, needsFetch, fetchedResource]);

  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editScope, setEditScope] = useState('');
  const [saving, setSaving] = useState(false);

  // AI summary state
  const [summaryJobId, setSummaryJobId] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ephemeralSummary, setEphemeralSummary] = useState(null);
  const [activeSummaryId, setActiveSummaryId] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [workerOutdatedWarned, setWorkerOutdatedWarned] = useState(false);
  const warnOnceRef = useRef(false);

  // Reading position tracking (text resources only)
  const previewScrollRef = useRef(null);
  const previewKindRef = useRef(null);
  const { savedPosition, isResuming, save: saveReadPosition, restore: restoreReadPosition, dismissResume } = useReadingPosition(open ? resource?.id : null);

  // Collapse sidebar when entering focus mode
  useEffect(() => {
    if (!open) return;
    if (expanded && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('academiai:request-sidebar', { detail: { collapsed: true } }),
      );
    }
  }, [expanded, open]);

  useEffect(() => {
    if (open) {
      // Reset transient UI state each time the dialog opens.
      // eslint-disable-next-line react/set-state-in-effect
      setExpanded(false);
      setEditing(false);
      setSummaryJobId(null);
      setSummaryLoading(false);
      setSummaryError('');
      setEphemeralSummary(null);
      setWorkerOutdatedWarned(false);
      warnOnceRef.current = false;
      const latest = resource?.latest_summary;
      if (latest?.id && latest?.summary) {
        setActiveSummaryId(latest.id);
      } else {
        setActiveSummaryId(null);
      }
      // Never auto-pop the summary banner on open — it stays collapsed behind
      // the "View summary" trigger so opening a resource is unobtrusive.
      setShowSummary(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Save reading position on close (text resources)
      if (previewScrollRef.current && previewKindRef.current === 'text') {
        const el = previewScrollRef.current;
        const total = el.scrollHeight - el.clientHeight;
        if (total > 0) {
          const pct = (el.scrollTop / total) * 100;
          if (pct > 1) saveReadPosition(pct);
        }
      }
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, resource?.id, resource?.latest_summary, saveReadPosition]);

  // ESC closes dialog / exits expanded
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

  // Saved summaries
  const {
    data: summaries = [],
    isLoading: summariesLoading,
    refetch: refetchSummaries,
  } = useQuery({
    queryKey: SUMMARIES_QUERY_KEY(resource?.id),
    queryFn: async () => {
      if (!resource?.id) return [];
      const { data } = await api.get(`/resources/${resource.id}/summaries/`);
      return Array.isArray(data) ? data : data?.results || [];
    },
    enabled: open && !!resource?.id && resource?.processing_status === 'ready',
    staleTime: 15_000,
  });

  const allSummaries = useMemo(() => {
    const list = [...(summaries || [])];
    if (ephemeralSummary && !list.some((s) => s.summary === ephemeralSummary.summary)) {
      list.unshift(ephemeralSummary);
    }
    return list;
  }, [summaries, ephemeralSummary]);

  const activeSummary = useMemo(() => {
    if (activeSummaryId) {
      const found = allSummaries.find((s) => String(s.id) === String(activeSummaryId));
      if (found) return found;
    }
    const latest = resource?.latest_summary;
    if (latest?.id && latest?.summary) return latest;
    return allSummaries[0] || null;
  }, [allSummaries, activeSummaryId, resource?.latest_summary]);

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
              const normalized = normalizeJobResult(r);
              if (!normalized) {
                setSummaryError('The AI returned an empty summary.');
                toast.error('The AI returned an empty summary.');
                return;
              }
              const refreshed = await refetchSummaries();
              const list = refreshed.data || [];
              const persisted =
                (!normalized.ephemeral && normalized.id && list.find((s) => String(s.id) === String(normalized.id)))
                || list[0]
                || null;

              if (persisted) {
                setEphemeralSummary(null);
                setActiveSummaryId(persisted.id);
                setShowSummary(true);
                toast.success('Summary saved');
              } else {
                setEphemeralSummary(normalized);
                setActiveSummaryId(normalized.id);
                setShowSummary(true);
                if (!warnOnceRef.current) {
                  warnOnceRef.current = true;
                  setWorkerOutdatedWarned(true);
                  toast.warning(
                    'Summary generated, but saving is currently unavailable. Contact your administrator for help.',
                    { duration: 8000 },
                  );
                } else {
                  toast.success('Summary ready (couldn\'t be saved — ask an admin)');
                }
              }
            }
          } else {
            setSummaryError(data.error || 'Summary failed.');
            toast.error(data.error || 'Summary failed');
          }
          qc.invalidateQueries({ queryKey: ['resources'] });
          return;
        }
        timer = setTimeout(tick, 1500);
      } catch (err) {
        if (cancelled) return;
        setSummaryLoading(false);
        setSummaryJobId(null);
        const msg = err.response?.data?.error?.detail || err.message || 'Could not poll summary job';
        setSummaryError(msg);
        toast.error(msg);
      }
    };
    timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [summaryJobId, open, qc, refetchSummaries]);

  const requestSummary = async () => {
    setSummaryError('');
    setSummaryLoading(true);
    try {
      const { data } = await api.post(`/resources/${resource.id}/summarize/`, {});
      setSummaryJobId(data.job_id);
    } catch (err) {
      setSummaryLoading(false);
      const msg = err.response?.data?.error?.detail || err.message || 'Could not start summary';
      setSummaryError(msg);
      toast.error(msg);
    }
  };

  const deleteSummary = async (summaryId) => {
    if (!summaryId) return;
    if (String(summaryId).startsWith(EPHEMERAL_PREFIX)) {
      setEphemeralSummary(null);
      if (String(activeSummaryId) === String(summaryId)) {
        setActiveSummaryId(null);
        setShowSummary(false);
      }
      toast.success('Unsaved summary dismissed');
      return;
    }
    setDeletingId(summaryId);
    try {
      await api.delete(`/resources/${resource.id}/summaries/${summaryId}/`);
      toast.success('Summary deleted');
      if (String(activeSummaryId) === String(summaryId)) {
        setActiveSummaryId(null);
        setShowSummary(false);
      }
      await refetchSummaries();
      qc.invalidateQueries({ queryKey: ['resources'] });
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Could not delete summary');
    } finally {
      setDeletingId(null);
    }
  };

  const isOwnerOrAdmin =
    !!user &&
    !!resource &&
    (user.role === 'tenant_admin' || user.is_superuser || resource.uploaded_by === user.id);

  const canDeleteSummary = (s) =>
    !!user &&
    !!s &&
    (user.is_superuser || user.role === 'tenant_admin' || !s.created_by || s.created_by === user.id);

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

  // Track preview kind in ref for use in close handler (can't use preview in deps above)
  useEffect(() => {
    previewKindRef.current = preview?.kind || null;
  }, [preview?.kind]);

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

  if (!resourceProp || !open) return null;

  // If we're still fetching a resource stub (id-only), show a minimal
  // loading dialog so the portal doesn't crash accessing undefined fields.
  if (needsFetch && (fetchingResource || !resource || !resource.title)) {
    const loadingContent = (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur">
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          <p className="text-xs text-muted-foreground">Loading material…</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
    if (typeof document === 'undefined') return null;
    return createPortal(loadingContent, document.body);
  }

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

  const confirmDelete = () => setDeleteOpen(true);

  const deleteResource = async () => {
    try {
      await api.delete(`/resources/${resource.id}/`);
      toast.success('Resource deleted');
      qc.invalidateQueries({ queryKey: ['resources'] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Delete failed');
    }
  };

  const savedCount = Array.isArray(summaries) ? summaries.length : 0;
  const hasAnySummary = !!activeSummary || savedCount > 0 || !!ephemeralSummary;
  const ft = getFileType(resource.title || '', resource.mime_type);
  const scopeMeta = SCOPE_META[resource.visibility_scope] || SCOPE_META.private;
  const FileIcon = ft.icon;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Resource: ${resource.title}`}
    >
      {/* Top bar */}
      <header className="glass flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to resources"
            title="Back"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className={cn('hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex', ft.tint)}>
            <FileIcon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold sm:text-[15px]">
              {resource.title}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={resource.processing_status} />
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', scopeMeta.tint)}>
                {scopeMeta.label}
              </span>
              {savedCount > 0 && (
                <span className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:inline-flex">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {savedCount} saved {savedCount === 1 ? 'summary' : 'summaries'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Exit focus mode' : 'Focus mode (F)'}
            aria-label={expanded ? 'Exit focus mode' : 'Focus mode'}
            className="h-8 w-8"
          >
            {expanded ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* AI Summary panel + status banners (extracted) */}
        <SummaryPanel
          activeSummary={activeSummary}
          allSummaries={allSummaries}
          show={showSummary}
          onShow={() => setShowSummary(true)}
          onSelectSummary={(id) => { setActiveSummaryId(id); setShowSummary(true); }}
          onDismiss={() => setShowSummary(false)}
          canDeleteSummary={canDeleteSummary}
          onDeleteSummary={deleteSummary}
          deletingId={deletingId}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          requestSummary={() => requestSummary()}
          savedCount={savedCount}
          workerOutdatedWarned={workerOutdatedWarned}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Preview */}
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', expanded ? '' : 'border-r')}>
            <div className="min-h-0 flex-1 overflow-hidden bg-muted/20">
              {resource.processing_status === 'failed' ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
                  <Alert variant="destructive" className="max-w-md">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">Processing failed.</span>{' '}
                      {resource.processing_error || 'The file could not be processed.'}
                    </AlertDescription>
                  </Alert>
                  {isOwnerOrAdmin && (
                    <Button type="button" size="sm" variant="outline" onClick={retry} disabled={retrying} className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400">
                      <RefreshCw className={cn('mr-2 h-3.5 w-3.5', retrying && 'animate-spin')} aria-hidden />
                      {retrying ? 'Restarting…' : 'Retry processing'}
                    </Button>
                  )}
                </div>
              ) : resource.processing_status !== 'ready' ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                  <p>This material is <span className="font-medium text-foreground">{resource.processing_status}</span>.</p>
                  <p className="max-w-sm text-center text-xs text-muted-foreground">
                    Text extraction and embedding are queued. The preview unlocks when processing completes. This usually takes 10–60 seconds.
                  </p>
                </div>
              ) : previewLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading preview…
                </div>
              ) : previewError ? (
                <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
                  Could not load the preview.
                </div>
              ) : preview?.kind === 'text' ? (
                <>
                  {isResuming && (
                    <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                      <BookmarkCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        You were {Math.round(savedPosition?.scroll_percentage || 0)}% through this document.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          restoreReadPosition(previewScrollRef);
                        }}
                        className="ml-1 font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={dismissResume}
                        className="ml-auto rounded p-0.5 hover:bg-amber-500/20"
                        aria-label="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <pre
                    ref={previewScrollRef}
                    data-testid="resource-preview-text"
                    className="h-full overflow-auto whitespace-pre-wrap p-6 font-mono text-[12.5px] leading-relaxed"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const total = el.scrollHeight - el.clientHeight;
                      if (total > 0) {
                        saveReadPosition((el.scrollTop / total) * 100);
                      }
                    }}
                  >
                    {preview.content}
                    {preview.truncated && '\n\n… (truncated at 512 KB — download for full file)'}
                  </pre>
                </>
              ) : preview?.kind === 'pdf' ? (
                <iframe
                  src={preview.preview_url}
                  title={`Preview of ${resource.title}`}
                  className="h-full w-full bg-background"
                />
              ) : preview?.kind === 'image' ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  <img src={preview.preview_url} alt={`Preview of ${resource.title}`} className="max-h-full max-w-full rounded-md object-contain shadow-sm" />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', ft.tint)}>
                    <FileIcon className="h-6 w-6" aria-hidden />
                  </div>
                  <p>{preview?.detail || 'Preview is not available for this file type.'}</p>
                  <Button type="button" variant="outline" size="sm" onClick={download}>
                    <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Download file
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Side panel */}
          {!expanded && (
            <ResourceSidePanel
              resource={resource}
              editing={editing}
              editTitle={editTitle}
              editDesc={editDesc}
              editScope={editScope}
              onTitleChange={setEditTitle}
              onDescChange={setEditDesc}
              onScopeChange={setEditScope}
              saving={saving}
              onSave={saveEdit}
              onCancelEdit={() => setEditing(false)}
              download={download}
              requestSummary={requestSummary}
              summaryLoading={summaryLoading}
              hasAnySummary={hasAnySummary}
              bookmarkIdFromData={bookmarkIdFromData}
              toggleBookmark={toggleBookmark}
              summariesLoading={summariesLoading}
              allSummaries={allSummaries}
              savedCount={savedCount}
              activeSummary={activeSummary}
              showSummary={showSummary}
              onSelectSummary={(id) => { setActiveSummaryId(id); setShowSummary(true); }}
              onToggleShowSummary={() => setShowSummary((v) => !v)}
              canDeleteSummary={canDeleteSummary}
              onDeleteSummary={deleteSummary}
              deletingId={deletingId}
              isOwnerOrAdmin={isOwnerOrAdmin}
              onStartEdit={startEdit}
              onConfirmDelete={confirmDelete}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this resource?"
        description="This will permanently delete the resource and its associated summaries. This cannot be undone."
        onConfirm={deleteResource}
        onCancel={() => setDeleteOpen(false)}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
