import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";

export default function ProgressPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const { data } = await api.get("/progress/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Learning progress">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((p) => (
            <Card key={p.id}><CardContent className="py-4 text-sm flex justify-between">
              <span>Concept: {p.concept}</span>
              <span className="font-medium">{p.progress_value}</span>
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No progress records yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
