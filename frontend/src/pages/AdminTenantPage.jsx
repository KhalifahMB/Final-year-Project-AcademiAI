import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminTenantPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data } = await api.get("/tenants/");
      return data.results || data;
    },
  });
  const tenant = Array.isArray(data) ? data[0] : data;
  return (
    <AppShell title="Tenant settings">
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : tenant ? (
        <Card className="max-w-lg">
          <CardHeader><CardTitle className="text-lg">{tenant.name}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Slug: {tenant.slug}</div>
            <div>Status: {tenant.status}</div>
            <div>Plan: {tenant.plan}</div>
          </CardContent>
        </Card>
      ) : <p className="text-sm text-muted-foreground">No tenant data</p>}
    </AppShell>
  );
}
