import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminProgrammesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["programmes"],
    queryFn: async () => {
      const { data } = await api.get("/programmes/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Programmes">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((p) => (
            <Card key={p.id}><CardContent className="py-3 text-sm font-medium">{p.name}{p.code ? ` (${p.code})` : ""}</CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
