import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import ResourceDetailDialog from "@/components/resources/ResourceDetailDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bookmark } from "lucide-react";

export default function BookmarksPage() {
  const [selected, setSelected] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const { data } = await api.get("/bookmarks/");
      return data.results || data;
    },
  });

  const bookmarks = data || [];

  return (
    <AppShell
      title="Bookmarks"
      description="Materials you've saved for quick access."
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>Failed to load bookmarks</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Open any material and press “Bookmark” to save it here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {bookmarks.map((b) => {
            const r = b.resource_detail;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => r && setSelected(r)}
                  disabled={!r}
                  className="card-surface card-surface-hover group flex w-full items-start gap-3 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Bookmark className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {r?.title || String(b.resource).slice(0, 8) + "…"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {r?.description || "No description"}
                    </span>
                    {r ? (
                      <span className="mt-2 inline-block">
                        <StatusBadge status={r.processing_status} />
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ResourceDetailDialog
        resource={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </AppShell>
  );
}
