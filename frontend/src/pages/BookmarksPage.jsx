import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bookmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

export default function BookmarksPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const { data } = await api.get('/bookmarks/');
      return data.results || data;
    },
  });

  const bookmarks = data || [];
  const totalPages = Math.max(1, Math.ceil(bookmarks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = bookmarks.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const removeMutation = useMutation({
    mutationFn: (id) => api.delete(`/bookmarks/${id}/`),
    onSuccess: () => {
      toast.success('Bookmark removed');
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
      setRemoveId(null);
    },
    onError: () => {
      toast.error('Could not remove bookmark');
    },
  });

  return (
    <AppShell
      title="Bookmarks"
      description="Materials you've saved for quick access."
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-xs">
            Failed to load bookmarks
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-[150px] rounded-xl"
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Open any material and press “Bookmark” to save it here for quick access."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((b) => {
            const r = b.resource_detail;
            if (!r) return null;
            return (
              <li key={b.id} className="group relative">
                <ResourceCard
                  resource={r}
                  onOpen={(res) => setSelected(res)}
                  onDeleted={() =>
                    qc.invalidateQueries({ queryKey: ['bookmarks'] })
                  }
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoveId(b.id);
                  }}
                  disabled={removeMutation.isPending && removeId === b.id}
                  className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-primary opacity-0 backdrop-blur transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove bookmark"
                  title="Remove bookmark"
                >
                  {removeMutation.isPending && removeId === b.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Bookmark
                      className="h-3.5 w-3.5 fill-current"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {bookmarks.length > PAGE_SIZE && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-4"
        />
      )}

      <ResourceDetailDialog
        resource={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['bookmarks'] })}
      />
      <ConfirmDialog
        open={!!removeId}
        title="Remove bookmark?"
        description="This material will be removed from your bookmarks."
        onCancel={() => setRemoveId(null)}
        onConfirm={() => removeMutation.mutate(removeId)}
        confirmLabel="Remove"
        confirmDisabled={removeMutation.isPending}
      />
    </AppShell>
  );
}
