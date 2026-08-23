import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export default function BookmarksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const { data } = await api.get("/bookmarks/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Bookmarks">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((b) => (
            <Card key={b.id}><CardContent className="py-4 text-sm">Resource: {b.resource}</CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No bookmarks yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
