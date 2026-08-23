import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function MyProgrammePage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["me-full"],
    queryFn: async () => (await api.get("/auth/me/")).data,
  });
  return (
    <AppShell title="My programme">
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-lg">Programme</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : (
            <>
              <p>Signed in as {data?.email || user?.email}.</p>
              <p className="mt-2">Programme details come from your student profile when assigned by an admin.</p>
              <p className="mt-2">Tenant: {String(data?.tenant || "—")}</p>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
