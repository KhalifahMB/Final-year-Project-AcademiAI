import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminOfferingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-offerings"],
    queryFn: async () => {
      const { data } = await api.get("/course-offerings/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Course offerings">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((o) => (
            <Card key={o.id}><CardContent className="py-3 text-sm">
              Offering {o.id?.slice?.(0, 8)}… · course {o.course} · status {o.status}
            </CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
