import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminDepartmentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments/")).data.results || (await api.get("/departments/")).data,
  });
  return (
    <AppShell title="Departments">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(Array.isArray(data) ? data : []).map((d) => (
            <Card key={d.id}><CardContent className="py-3 text-sm font-medium">{d.name}{d.code ? ` (${d.code})` : ""}</CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
