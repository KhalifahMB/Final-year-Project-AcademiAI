import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StatusBadge from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Building2, ShieldCheck } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  const mb = 1024 ** 2;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

export default function AdminTenantPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data } = await api.get("/tenants/");
      return data.results || data;
    },
  });
  const tenant = Array.isArray(data) ? data[0] : data;

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/tenants/${tenant.id}/`, {
        name: name.trim(),
        domain: domain.trim(),
      }),
    onSuccess: () => {
      toast.success("Tenant profile updated");
      setEditing(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (err) => {
      const d =
        err.response?.data?.error?.detail ||
        err.response?.data?.detail ||
        "Update failed";
      setError(typeof d === "string" ? d : JSON.stringify(d));
    },
  });

  const openEdit = () => {
    setName(tenant.name || "");
    setDomain(tenant.domain || "");
    setError("");
    setEditing(true);
  };

  return (
    <AppShell
      title="Tenant settings"
      description="Your institution's workspace profile. Plan, status and storage quota are managed by the platform operator."
    >
      {loadError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load tenant settings</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tenant ? (
        <Card className="max-w-xl">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              {tenant.name}
            </CardTitle>
            <StatusBadge status={tenant.status} />
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{String(error)}</AlertDescription>
              </Alert>
            )}

            {!editing ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Slug</p>
                    <p className="font-medium">{tenant.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Domain</p>
                    <p className="font-medium">{tenant.domain || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
                    <p className="font-medium capitalize">{tenant.plan}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Storage quota
                    </p>
                    <p className="font-medium">{formatBytes(tenant.storage_quota_bytes)}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={openEdit} className="shadow-sm">
                  Edit profile
                </Button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="tenant-name">Institution name</Label>
                  <Input
                    id="tenant-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tenant-domain">Domain (optional)</Label>
                  <Input
                    id="tenant-domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. university.edu"
                    className="h-10"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={save.isPending} className="shadow-sm">
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    disabled={save.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Faculties, departments, programmes and courses for your institution are
              managed under the Administration section.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No tenant data</p>
      )}
    </AppShell>
  );
}
