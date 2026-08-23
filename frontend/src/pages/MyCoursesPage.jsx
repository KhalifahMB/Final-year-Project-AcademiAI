import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get("/course-enrollments/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="My courses">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load enrollments</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 text-sm flex justify-between">
                <span>Offering {String(e.course_offering).slice(0, 8)}… · {e.status}</span>
                <Link className="text-primary text-xs hover:underline" to={`/courses/${e.course_offering}`}>Details</Link>
              </CardContent>
            </Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No enrollments.</p>}
        </ul>
      )}
    </AppShell>
  );
}
