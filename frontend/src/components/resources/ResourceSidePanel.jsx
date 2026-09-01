import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatBytes, getFileType, SCOPE_META } from '@/lib/filetypes';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  Download,
  FilePenLine,
  History,
  Info,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';

const SCOPES = ['private', 'course', 'programme', 'department', 'faculty', 'institution'];

function formatDate(iso) {
  if (!iso) return 'just now';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ''; }
}

export default function ResourceSidePanel({
  resource,
  editing,
  editTitle,
  editDesc,
  editScope,
  onTitleChange,
  onDescChange,
  onScopeChange,
  saving,
  onSave,
  onCancelEdit,
  download,
  requestSummary,
  summaryLoading,
  hasAnySummary,
  bookmarkIdFromData,
  toggleBookmark,
  summariesLoading,
  allSummaries = [],
  savedCount,
  activeSummary,
  showSummary,
  onSelectSummary,
  onToggleShowSummary,
  canDeleteSummary,
  onDeleteSummary,
  deletingId,
  isOwnerOrAdmin,
  onStartEdit,
  onConfirmDelete,
}) {
  const ft = resource ? getFileType(resource.title || '', resource.mime_type) : null;
  const scopeMeta = resource ? SCOPE_META[resource.visibility_scope] || SCOPE_META.private : null;
  if (!resource) return null;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-card/50 p-4">
      {editing ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edit resource</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={editTitle} onChange={(e) => onTitleChange(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={editDesc} onChange={(e) => onDescChange(e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Visibility</Label>
            <Select value={editScope} onValueChange={onScopeChange}>
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
            <Button type="button" size="sm" onClick={onSave} disabled={saving} className="flex-1 h-8 text-xs">
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancelEdit} className="h-8 text-xs">
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
                        onClick={() => onSelectSummary(s.id)}
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
                          onClick={(e) => { e.stopPropagation(); onDeleteSummary(s.id); }}
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
                    onClick={onToggleShowSummary}
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
                <Button type="button" size="sm" variant="outline" className="w-full justify-start h-8 text-xs" onClick={onStartEdit}>
                  <FilePenLine className="mr-2 h-3.5 w-3.5" aria-hidden /> Edit details
                </Button>
                <Button type="button" size="sm" variant="destructive" className="w-full justify-start h-8 text-xs" onClick={onConfirmDelete}>
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
  );
}

function MetaRow({ label, value, valueClass }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right font-medium text-foreground', valueClass)}>{value}</dd>
    </div>
  );
}
