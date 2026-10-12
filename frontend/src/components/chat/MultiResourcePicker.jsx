import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { getFileType } from '@/lib/filetypes';
import { Check, Loader2, X } from 'lucide-react';

/* ---------------- Resource picker popover ---------------- */

export default function MultiResourcePicker({
  open,
  onClose,
  selected,
  onToggle,
}) {
  const {
    data: resources,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['chat-materials'],
    queryFn: async () => {
      const { data } = await api.get('/resources/?page_size=200');
      return data.results || data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const ready = useMemo(
    () => (resources || []).filter((r) => r.processing_status === 'ready'),
    [resources],
  );
  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border bg-popover"
      role="dialog"
      aria-label="Attach materials"
    >
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <div>
          <p className="text-xs font-semibold">Attach materials</p>
          <p className="text-[10px] text-muted-foreground">
            {selected.length} selected · click to toggle
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ul className="max-h-72 overflow-y-auto p-1.5">
        {error ? (
          <li className="px-3 py-6 text-center text-xs text-destructive">
            Could not load your materials.
          </li>
        ) : isLoading || resources === undefined ? (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />{' '}
            Loading…
          </li>
        ) : ready.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            No processed materials yet — upload one first.
          </li>
        ) : (
          ready.map((r) => {
            const isSelected = selectedIds.has(r.id);
            const ft = getFileType(r.title || '', r.mime_type || '');
            const FileIcon = ft.icon;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onToggle(r)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                      ft.tint,
                    )}
                  >
                    <FileIcon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {r.title}
                    </span>
                    <span className="block truncate text-[10px] capitalize text-muted-foreground">
                      {r.visibility_scope} scope
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
