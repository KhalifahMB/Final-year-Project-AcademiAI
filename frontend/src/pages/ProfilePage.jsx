import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <AppShell title="Profile">
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-lg">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Name:</span> {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "—"}</div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Role:</span>
            <Badge>{user?.role}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Email verified:</span>
            <Badge variant={user?.is_email_verified ? "success" : "secondary"}>
              {user?.is_email_verified ? "Yes" : "No"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
