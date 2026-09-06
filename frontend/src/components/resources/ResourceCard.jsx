import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { getFileType, SCOPE_META } from '@/lib/filetypes';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Clock,
  MoreVertical,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(iso) {
  if (!iso) return '';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ''; }
}

/**
 * A compact, premium resource card used in the resources grid and
 * related-resource sidebars. Keeps all existing logic (owner delete,
 * processing errors, scoped visibility chips, latest summary badge).
 */
export default function ResourceCard({
  resource,
  onOpen,
  onDeleted,
  className,
}) {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ft = getFileType(resource?.title || '', resource?.mime_type);
  const scope = SCOPE_META[resource?.visibility_scope] || SCOPE_META.private;

  const isOwnerOrAdmin =
    !!user &&
    !!resource &&
    (user.role === 'tenant_admin' || user.is_superuser || resource.uploaded_by === user.id);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/resources/${resource.id}/`);
      toast.success('Resource deleted');
      setDeleteOpen(false);
      if (onDeleted) onDeleted(resource.id);
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const failed = resource?.processing_status === 'failed';
  const ready = resource?.processing_status === 'ready';
  const hasSummary = !!resource?.latest_summary?.summary;

  const FileIcon = ft.icon;
  const interactive = !!onOpen;

  // No button-inside-button nesting: the card itself is inert; the title
  // is the open control and the menu is its sibling.
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-xl border bg-card p-4',
        'transition-all duration-150 ease-out',
        interactive && 'hover:border-primary/40 hover:shadow-[0_4px_16px_-8px_color-mix(in_oklab,var(--primary)_35%,transparent)]',
        className,
      )}
    >
      {/* Actions */}
      {isOwnerOrAdmin && (
        <div className="absolute right-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5" />
                <span className="sr-only">Open menu for {resource?.title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Header row: icon + title */}
      <div className="flex items-start gap-3 pr-6">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            ft.tint,
          )}
        >
          <FileIcon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {interactive ? (
              <button
                type="button"
                onClick={() => onOpen(resource)}
                className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-semibold leading-snug transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="block truncate" title={resource?.title}>
                  {resource?.title}
                </span>
              </button>
            ) : (
              <h2
                className="truncate text-sm font-semibold leading-snug"
                title={resource?.title}
              >
                {resource?.title}
              </h2>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">{ft.label}</span>
            {resource?.uploaded_by_username && (
              <>
                <span className="text-border">·</span>
                <User className="h-2.5 w-2.5" aria-hidden />
                <span className="truncate">{resource.uploaded_by_username}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-2.5 line-clamp-2 min-h-[2.4rem] text-xs leading-relaxed text-muted-foreground">
        {resource?.description || <span className="italic">No description provided.</span>}
      </p>

      {/* Processing error */}
      {failed && resource?.processing_error ? (
        <p className="mt-2.5 line-clamp-2 rounded-md border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--danger)]">
          {resource.processing_error}
        </p>
      ) : null}

      {/* Footer: chips + open affordance */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3.5">
        <StatusBadge status={resource?.processing_status} />
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-[10px] font-medium capitalize',
            scope.tint,
          )}
        >
          {scope.label}
        </span>
        {ready && hasSummary && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Summary
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {timeAgo(resource?.created_at)}
        </span>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete resource"
        description="This cannot be undone. The resource and all its data will be permanently removed."
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        confirmLabel="Delete"
        destructive
        pending={deleting}
      />
    </article>
  );
}
