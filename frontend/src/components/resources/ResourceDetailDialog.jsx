import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import api from '@/services/api';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatBytes, getFileType, SCOPE_META } from '@/lib/filetypes';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Clock,
  Download,
  FilePenLine,
  History,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  X,
} from 'lucide-react';

const SUMMARIES_QUERY_KEY = (resourceId) => ['resource-summaries', resourceId];
const EPHEMERAL_PREFIX = 'ephemeral-';
const SCOPES = ['private', 'course', 'programme', 'department', 'faculty', 'institution'];

function formatDate(iso) {
  if (!iso) return 'just now';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ''; }
}

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
      const list = await api.get('/resources/').then((resp) => resp.data?.results || resp.data || []);
      return list.find((item) => String(item.id) === String(resourceProp.id)) || null;
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
  const [showHistory, setShowHistory] = useState(false);

  // AI summary state
  const [summaryJobId, setSummaryJobId] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ephemeralSummary, setEphemeralSummary] = useState(null);
  const [activeSummaryId, setActiveSummaryId] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [workerOutdatedWarned, setWorkerOutdatedWarned] = useState(false);
  const warnOnceRef = useRef(false);

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
      setShowHistory(false);
      setEphemeralSummary(null);
      setWorkerOutdatedWarned(false);
      warnOnceRef.current = false;
      const latest = resource?.latest_summary;
      if (latest?.id && latest?.summary) {
        setActiveSummaryId(latest.id);
        setShowSummary(true);
      } else {
        setActiveSummaryId(null);
        setShowSummary(false);
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, resource?.id, resource?.latest_summary]);

  // ESC closes dialog / exits expanded
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (expanded) setExpanded(false);
        else if (showHistory) setShowHistory(false);
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
  }, [open, expanded, onClose, showHistory]);

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
                    'Summary generated but not saved — restart the Celery worker and run `python manage.py migrate`.',
                    { duration: 8000 },
                  );
                } else {
                  toast.success('Summary ready (not saved — restart Celery worker)');
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
    (user.role === 'admin' || user.is_superuser || resource.uploaded_by === user.id);

  const canDeleteSummary = (s) =>
    !!user &&
    !!s &&
    (user.is_superuser || user.role === 'admin' || !s.created_by || s.created_by === user.id);

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

  const deleteResource = async () => {
    if (!window.confirm('Delete this resource? This cannot be undone.')) return;
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
        {/* AI Summary panel (full-width, anchored below header) */}
        {showSummary && activeSummary && (
          <div className="shrink-0 border-b ai-gradient">
            <div className="mx-auto max-w-4xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">AI Summary</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatDate(activeSummary.created_at)}
                      </span>
                      {activeSummary.created_by_name && (
                        <span className="hidden items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10 sm:inline-flex">
                          <User className="h-3 w-3" aria-hidden />
                          {activeSummary.created_by_name}
                        </span>
                      )}
                      {activeSummary.ephemeral && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          Not saved — restart Celery
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {canDeleteSummary(activeSummary) && (
                        <button
                          type="button"
                          onClick={() => deleteSummary(activeSummary.id)}
                          disabled={deletingId === activeSummary.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                          title={activeSummary.ephemeral ? 'Dismiss' : 'Delete this summary'}
                        >
                          {deletingId === activeSummary.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-3 w-3" aria-hidden />
                          )}
                          {activeSummary.ephemeral ? 'Dismiss' : 'Delete'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSummary(false)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Dismiss summary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="prose-academic mt-2 max-w-none text-[13.5px] leading-relaxed">
                    <ReactMarkdown>{activeSummary.summary || 'No summary text returned.'}</ReactMarkdown>
                  </div>

                  {Array.isArray(activeSummary.key_points) && activeSummary.key_points.length > 0 && (
                    <div className="mt-3 rounded-lg border bg-background/60 p-3 backdrop-blur">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Key points
                      </p>
                      <ul className="list-disc space-y-0.5 pl-5 text-[12.5px]">
                        {activeSummary.key_points.map((kp, i) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {allSummaries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowHistory((v) => !v)}
                      className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {showHistory ? 'Hide summary history' : `View all ${allSummaries.length} summaries`}
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')}
                        aria-hidden
                      />
                    </button>
                  )}
                  {showHistory && allSummaries.length > 1 && (
                    <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border bg-background/60 p-2 backdrop-blur">
                      {allSummaries.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setActiveSummaryId(s.id); setShowSummary(true); }}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                            String(s.id) === String(activeSummary?.id) && 'bg-primary/10 ring-1 ring-primary/20',
                          )}
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-semibold text-white">
                            <Sparkles className="h-3 w-3" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">
                                {(s.summary || '').split('\n')[0]?.slice(0, 100) || '(empty)'}
                              </span>
                              {s.ephemeral && (
                                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  unsaved
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden />
                              {formatDate(s.created_at)}
                              {s.created_by_name && (
                                <>
                                  <span>•</span>
                                  <User className="h-3 w-3" aria-hidden />
                                  {s.created_by_name}
                                </>
                              )}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {workerOutdatedWarned && (
          <div className="shrink-0 border-b bg-amber-50 px-4 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <strong>Heads up:</strong> Summaries are showing but not being saved. Stop the Celery worker and restart it with: <code className="rounded bg-black/10 px-1 dark:bg-white/10">celery -A config worker -l INFO -P solo -Q ai,celery,email,ingestion</code>, then run <code className="rounded bg-black/10 px-1 dark:bg-white/10">python manage.py migrate</code>.
          </div>
        )}
        {summaryLoading && (
          <div className="shrink-0 border-b bg-primary/5 px-5 py-2.5">
            <div className="mx-auto flex max-w-4xl items-center gap-2 text-xs text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Generating AI summary… this takes a few seconds. It will be saved automatically.
            </div>
          </div>
        )}
        {summaryError && !summaryLoading && (
          <div className="shrink-0 border-b bg-red-500/10 px-5 py-2 text-xs text-red-700 dark:text-red-400">
            {summaryError}
          </div>
        )}

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
                <pre className="h-full overflow-auto whitespace-pre-wrap p-6 font-mono text-[12.5px] leading-relaxed">
                  {preview.content}
                  {preview.truncated && '\n\n… (truncated at 512 KB — download for full file)'}
                </pre>
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
            <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-card/50 p-4">
              {editing ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edit resource</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Visibility</Label>
                    <Select value={editScope} onValueChange={setEditScope}>
                      <SelectTrigger className="h-8 w-full capitalize text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCOPES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-sm">{SCOPE_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" onClick={saveEdit} disabled={saving} className="flex-1 h-8 text-xs">
                      {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-8 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick actions */}
                  <div className="space-y-1.5">
                    <Button type="button" size="sm" variant="default" className="w-full justify-start h-8 text-xs" onClick={download}>
                      <Download className="mr-2 h-3.5 w-3.5" aria-hidden /> Download
                    </Button>
                    {resource.processing_status === 'ready' && resource.has_extractable_text !== false && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={requestSummary}
                        disabled={summaryLoading}
                        className="w-full justify-start h-8 bg-gradient-to-r from-indigo-500 to-violet-600 text-xs text-white hover:from-indigo-600 hover:to-violet-700"
                      >
                        {summaryLoading
                          ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                          : <Sparkles className="mr-2 h-3.5 w-3.5" aria-hidden />}
                        {summaryLoading
                          ? 'Summarizing…'
                          : hasAnySummary ? 'Generate new summary' : 'Summarize with AI'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={bookmarkIdFromData ? 'secondary' : 'outline'}
                      className="w-full justify-start h-8 text-xs"
                      onClick={toggleBookmark}
                    >
                      {bookmarkIdFromData
                        ? <BookmarkCheck className="mr-2 h-3.5 w-3.5 text-primary" aria-hidden />
                        : <Bookmark className="mr-2 h-3.5 w-3.5" aria-hidden />}
                      {bookmarkIdFromData ? 'Bookmarked' : 'Bookmark'}
                    </Button>
                  </div>

                  {/* Metadata card */}
                  <div className="rounded-lg border bg-background/60 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Info className="h-3 w-3" aria-hidden /> Details
                    </p>
                    <dl className="space-y-1.5 text-[11px]">
                      <MetaRow label="Type" value={ft.label} />
                      <MetaRow label="Visibility" value={scopeMeta.label} valueClass={scopeMeta.tint} />
                      <MetaRow label="Uploaded" value={formatDate(resource.created_at)} />
                      {resource.uploaded_by_username && (
                        <MetaRow label="By" value={resource.uploaded_by_username} />
                      )}
                      {typeof resource.file_size_bytes === 'number' && resource.file_size_bytes > 0 && (
                        <MetaRow label="Size" value={formatBytes(resource.file_size_bytes)} />
                      )}
                    </dl>
                  </div>

                  {/* Summaries list */}
                  {resource.processing_status === 'ready' &&
                    resource.has_extractable_text !== false &&
                    (summariesLoading || allSummaries.length > 0) && (
                      <div className="rounded-lg border bg-background/60 p-2">
                        <p className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <History className="h-3 w-3" aria-hidden /> Summaries
                          {summariesLoading && <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden />}
                          {savedCount > 0 && (
                            <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                              {savedCount} saved
                            </span>
                          )}
                        </p>
                        {allSummaries.length === 0 && !summariesLoading && (
                          <p className="px-1 py-2 text-[11px] text-muted-foreground">
                            No summaries yet — click “Summarize with AI” to generate one.
                          </p>
                        )}
                        <div className="max-h-60 space-y-1 overflow-y-auto">
                          {allSummaries.map((s) => (
                            <div
                              key={s.id}
                              className={cn(
                                'group flex items-start gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors',
                                String(s.id) === String(activeSummary?.id) && showSummary
                                  ? 'bg-primary/10 ring-1 ring-primary/20'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => { setActiveSummaryId(s.id); setShowSummary(true); }}
                                className="min-w-0 flex-1 text-left"
                                title={(s.summary || '').slice(0, 200)}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate font-medium">
                                    {(s.summary || '').split('\n')[0]?.slice(0, 70) || '(empty)'}
                                  </span>
                                  {s.ephemeral && (
                                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                      unsaved
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" aria-hidden />
                                  {formatDate(s.created_at)}
                                </span>
                              </button>
                              {canDeleteSummary(s) && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); deleteSummary(s.id); }}
                                  disabled={deletingId === s.id}
                                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                                  aria-label={s.ephemeral ? 'Dismiss' : 'Delete summary'}
                                  title={s.ephemeral ? 'Dismiss' : 'Delete summary'}
                                >
                                  {deletingId === s.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3 w-3" aria-hidden />
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {activeSummary && showSummary && (
                          <button
                            type="button"
                            onClick={() => setShowSummary(false)}
                            className="mt-1 w-full rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            Hide summary panel
                          </button>
                        )}
                      </div>
                    )}

                  {/* Owner/admin management */}
                  {isOwnerOrAdmin && (
                    <>
                      <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manage</p>
                      <div className="space-y-1.5">
                        <Button type="button" size="sm" variant="outline" className="w-full justify-start h-8 text-xs" onClick={startEdit}>
                          <FilePenLine className="mr-2 h-3.5 w-3.5" aria-hidden /> Edit details
                        </Button>
                        <Button type="button" size="sm" variant="destructive" className="w-full justify-start h-8 text-xs" onClick={deleteResource}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden /> Delete
                        </Button>
                      </div>
                    </>
                  )}

                  {resource.has_extractable_text === false && (
                    <Alert className="mt-2">
                      <Info className="h-3.5 w-3.5" />
                      <AlertDescription className="text-[11px]">
                        This material contains no extractable text (binary/OCR content). It's available for preview and download but cannot be summarized or searched.
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

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

function MetaRow({ label, value, valueClass }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right font-medium text-foreground', valueClass)}>{value}</dd>
    </div>
  );
}
