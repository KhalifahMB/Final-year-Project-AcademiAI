import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminAuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await api.get("/audit-logs/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Audit logs">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Admin only or request failed</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((a) => (
            <Card key={a.id}><CardContent className="py-3 text-sm">
              <div className="font-medium">{a.action}</div>
              <div className="text-muted-foreground text-xs">{a.entity_type} {a.entity_id} · {a.created_at}</div>
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No audit entries.</p>}
        </ul>
      )}
    </AppShell>
  );
}
