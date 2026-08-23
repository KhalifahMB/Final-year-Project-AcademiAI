import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminUsersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await api.get("/auth/users/");
      return data.results || data;
    },
  });
  return (
    <AppShell title="Users">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Admin access required or request failed</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((u) => (
            <Card key={u.id}><CardContent className="py-3 text-sm flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-medium">{u.email}</div>
                <div className="text-muted-foreground text-xs">{[u.first_name, u.last_name].filter(Boolean).join(" ")}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Badge>{u.role}</Badge>
                <Badge variant={u.is_active ? "success" : "secondary"}>{u.is_active ? "active" : "inactive"}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
