import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";

const toList = (d) => d?.results || d || [];

/**
 * Platform console (superuser only): the tenant registry. Platform
 * operators suspend or reactivate institutions — institution internals
 * (faculties, users, materials) belong to the tenant's own admins.
 */
export default function PlatformConsolePage() {
  const qc = useQueryClient();

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => toList((await api.get("/tenants/?page_size=200")).data),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/tenants/${id}/`, { status }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "suspended"
          ? "Tenant suspended — logins are disabled after the grace period"
          : "Tenant reactivated",
      );
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.error?.detail || e?.response?.data?.detail || "Status update failed"),
  });

  return (
    <AppShell
      title="Platform console"
      description="All institutions on AcademiAI. Suspend to cut off access; internals are managed by each institution's admins."
    >
      {tenantsQ.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load tenants — superuser access required.</AlertDescription>
        </Alert>
      ) : null}

      {tenantsQ.isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Institution</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tenantsQ.data || []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-3.5 font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.slug}</TableCell>
                  <TableCell className="text-sm capitalize">{t.plan || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.status === "active" ? "default" : t.status === "suspended" ? "destructive" : "secondary"
                      }
                      className="capitalize"
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status === "suspended" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: t.id, status: "active" })}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Reactivate
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending || t.status !== "active"}
                        onClick={() => {
                          if (window.confirm(`Suspend ${t.name}? User logins will be disabled after the grace period.`)) {
                            setStatus.mutate({ id: t.id, status: "suspended" });
                          }
                        }}
                      >
                        <Pause className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Suspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(tenantsQ.data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No tenants yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
