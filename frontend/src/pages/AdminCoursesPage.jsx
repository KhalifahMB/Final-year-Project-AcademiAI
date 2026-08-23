import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await api.get("/courses/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Courses (admin)">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((c) => (
            <Card key={c.id}><CardContent className="py-3 text-sm font-medium">{c.code} — {c.title}</CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
