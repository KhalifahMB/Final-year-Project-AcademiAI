import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RotateCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * ResourceDetailPage — routable detail view at `/resources/:id`.
 *
 * The same portal dialog the list page used is driven here from the URL so
 * a resource detail is deep-linkable, back/forward safe, and shareable. The
 * by-id fetch shares the dialog's cache key and is kept fresh for 5 minutes
 * (gc 30 minutes); when arriving from the resources list the payload is
 * seeded from the already-cached list entry so the overlay opens instantly
 * with no network round-trip.
 */
export default function ResourceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const {
    data: resource,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['resource-by-id', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/resources/${id}/`);
      return data || null;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: () => {
      const list = qc.getQueryData(['resources', user?.role]);
      const arr = Array.isArray(list) ? list : list?.results || [];
      return arr.find((r) => String(r.id) === String(id));
    },
  });

  const close = () => navigate('/resources');

  return (
    <AppShell
      title="Resources"
      description="Resource details — preview, notes, summaries and sharing."
    >
      <div className="flex min-h-[55vh] items-center justify-center px-4">
        {isError ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>
              <p className="font-medium">This resource could not be loaded.</p>
              <p className="mt-1 text-sm">It may have been removed or your access changed.</p>
            </AlertDescription>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Back to resources
              </Button>
            </div>
          </Alert>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading resource…
          </div>
        )}
      </div>

      <ResourceDetailDialog
        resource={resource || { id }}
        open
        onClose={close}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['resources', user?.role] })}
      />
    </AppShell>
  );
}