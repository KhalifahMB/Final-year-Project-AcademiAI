import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AssignedCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["lecturer-assignments"],
    queryFn: async () => {
      const { data } = await api.get("/lecturer-assignments/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Assigned courses">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load assignments</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((a) => (
            <Card key={a.id}><CardContent className="py-3 text-sm">Offering {a.course_offering}</CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No assignments.</p>}
        </ul>
      )}
    </AppShell>
  );
}
