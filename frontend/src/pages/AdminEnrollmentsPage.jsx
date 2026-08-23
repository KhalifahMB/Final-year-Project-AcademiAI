import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminEnrollmentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data } = await api.get("/course-enrollments/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Enrollments">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((e) => (
            <Card key={e.id}><CardContent className="py-3 text-sm">
              Student {e.student} · offering {e.course_offering} · {e.status}
            </CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
