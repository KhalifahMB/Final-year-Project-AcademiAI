import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

export default function MyProgrammePage() {
  const { user } = useAuth();
  const programmes = useQuery({
    queryKey: ["programmes"],
    queryFn: async () => {
      const { data } = await api.get("/programmes/");
      return data.results || data;
    },
  });

  const profile = user;
  return (
    <AppShell title="My programme">
      {!user ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Could not load profile</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Student identity</CardTitle>
            <CardDescription>From your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Email: {profile?.email || "—"}</div>
            <div>
              Name: {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "—"}
            </div>
            <div className="flex items-center gap-2">
              Role: <Badge>{profile?.role || "—"}</Badge>
            </div>
            <div>
              Verified:{" "}
              <Badge variant={profile?.is_email_verified ? "default" : "secondary"}>
                {profile?.is_email_verified ? "yes" : "no"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Programmes in your tenant</CardTitle>
            <CardDescription>Contact admin to attach a student profile to a programme</CardDescription>
          </CardHeader>
          <CardContent>
            {programmes.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(programmes.data || []).map((p) => (
                  <li key={p.id} className="flex justify-between border-b pb-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.code}</span>
                  </li>
                ))}
                {(programmes.data || []).length === 0 && (
                  <p className="text-muted-foreground">No programmes configured yet.</p>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
