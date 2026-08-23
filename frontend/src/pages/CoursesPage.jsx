import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await api.get("/courses/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Courses">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load courses</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((c) => (
            <Card key={c.id}><CardContent className="py-4">
              <div className="font-medium">{c.code ? `${c.code} — ${c.title}` : c.title}</div>
              {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No courses yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
