import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminAdminCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await api.get("/courses/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="AdminCourses">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((item) => (
            <Card key={item.id}><CardContent className="py-3 text-sm">
              <pre className="whitespace-pre-wrap text-xs overflow-auto">{JSON.stringify(item, null, 2)}</pre>
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No records.</p>}
        </ul>
      )}
    </AppShell>
  );
}
