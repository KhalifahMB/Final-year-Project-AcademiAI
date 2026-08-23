import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminFacultiesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => {
      const { data } = await api.get("/faculties/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Faculties">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((f) => (
            <Card key={f.id}><CardContent className="py-4 text-sm">
              <span className="font-medium">{f.name}</span>
              {f.code && <span className="text-muted-foreground"> · {f.code}</span>}
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No faculties yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
