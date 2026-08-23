import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CourseDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-offering", id],
    queryFn: async () => (await api.get(`/course-offerings/${id}/`)).data,
    enabled: !!id,
  });
  const resources = useQuery({
    queryKey: ["resources", id],
    queryFn: async () => {
      const { data } = await api.get("/resources/", { params: { course_offering: id } });
      return data.results || data;
    },
    enabled: !!id,
  });
  return (
    <AppShell title="Course details">
      <Link to="/my-courses" className="mb-4 inline-block text-sm text-primary hover:underline">← My courses</Link>
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Not found or unauthorized</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Offering</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>ID: {data.id}</div>
            <div>Course: {data.course}</div>
            <div>Status: {data.status}</div>
          </CardContent>
        </Card>
      )}
      <h2 className="font-semibold mb-2">Resources</h2>
      <ul className="space-y-2">
        {(resources.data || []).map((r) => (
          <Card key={r.id}><CardContent className="py-3 text-sm">{r.title} · {r.processing_status}</CardContent></Card>
        ))}
        {!resources.isLoading && (resources.data || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No resources for this offering.</p>
        )}
      </ul>
    </AppShell>
  );
}
