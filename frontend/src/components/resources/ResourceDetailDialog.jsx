import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Bookmark,
  BookmarkCheck,
  Download,
  FilePenLine,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
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

  useEffect(() => {
    if (open) {
      setExpanded(false);
      setEditing(false);
    }
  }, [open, resource?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (expanded) {
          setExpanded(false);
        } else {
          onClose();
        }
        e.preventDefault();
      }
      if (e.key === 'f' || e.key === 'F') setExpanded((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, expanded, onClose]);

  const isOwnerOrAdmin =
    !!user && !!resource &&
    (user.role === 'admin' || resource.uploaded_by === user.id);

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

  const bookmarkIdFromData = bookmarks && resource
    ? (bookmarks.find((b) => b.resource === resource.id)?.id || null)
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Resource: ${resource.title}`}>
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{resource.title}</h2>
            <div className="flex items-center gap-2 pt-0.5">
              <StatusBadge status={resource.processing_status} />
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                {resource.visibility_scope}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)} title={expanded ? 'Exit fullscreen' : 'Fullscreen'}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Preview area */}
        <div className={cn('flex-1 overflow-hidden', expanded ? '' : 'border-r')}>
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
                  <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
                  {retrying ? 'Restarting…' : 'Retry processing'}
                </Button>
              )}
            </div>
          ) : resource.processing_status !== 'ready' ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              This material is {resource.processing_status}. Preview unlocks when processing completes.
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
            <pre className="h-full overflow-auto whitespace-pre-wrap p-6 text-[13px] leading-relaxed chat-scroll">
              {preview.content}
              {preview.truncated ? '\n\n… (truncated at 512 KB — download for full file)' : ''}
            </pre>
          ) : preview?.kind === 'pdf' ? (
            <iframe src={preview.preview_url} title={`Preview of ${resource.title}`} className="h-full w-full" />
          ) : preview?.kind === 'image' ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img src={preview.preview_url} alt={`Preview of ${resource.title}`} className="max-h-full max-w-full rounded-md object-contain shadow-sm" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              <p>{preview?.detail || 'Preview not available for this file type.'}</p>
              <Button type="button" variant="outline" size="sm" onClick={download}>
                <Download className="mr-2 h-4 w-4" aria-hidden /> Download file
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar (when not expanded) */}
        {!expanded && (
          <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l bg-card/50 p-4 chat-scroll">
            {editing ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edit Resource</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Visibility</label>
                  <select value={editScope} onChange={(e) => setEditScope(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                    <option value="private">Private</option>
                    <option value="course">Course</option>
                    <option value="programme">Programme</option>
                    <option value="department">Department</option>
                    <option value="faculty">Faculty</option>
                    <option value="institution">Institution</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" size="sm" onClick={saveEdit} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
                <div className="space-y-2">
                  <Button type="button" size="sm" className="w-full justify-start" onClick={download}>
                    <Download className="mr-2 h-4 w-4" aria-hidden /> Download
                  </Button>
                  <Button type="button" size="sm" variant={bookmarkIdFromData ? 'secondary' : 'outline'} className="w-full justify-start" onClick={toggleBookmark}>
                    {bookmarkIdFromData ? <BookmarkCheck className="mr-2 h-4 w-4 text-primary" aria-hidden /> : <Bookmark className="mr-2 h-4 w-4" aria-hidden />}
                    {bookmarkIdFromData ? 'Bookmarked' : 'Bookmark'}
                  </Button>
                </div>

                {isOwnerOrAdmin && (
                  <>
                    <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manage</p>
                    <div className="space-y-2">
                      <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={startEdit}>
                        <FilePenLine className="mr-2 h-4 w-4" aria-hidden /> Edit details
                      </Button>
                      <Button type="button" size="sm" variant="destructive" className="w-full justify-start" onClick={deleteResource}>
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete
                      </Button>
                    </div>
                  </>
                )}

                {resource.has_extractable_text === false && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">
                      This material contains no extractable text (binary/OCR content). It is available for preview and download but cannot be summarized or searched.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
