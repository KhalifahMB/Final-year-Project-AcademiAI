import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const tenantSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  plan: z.enum(["standard", "professional", "enterprise"]),
  storage_quota_gb: z.coerce.number().min(1).max(10240),
});

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  return bytes >= gb ? `${(bytes / gb).toFixed(0)} GB` : `${bytes} B`;
}

export default function PlatformConsolePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperuser = !!user?.is_superuser;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const tenants = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const { data } = await api.get("/tenants/");
      return data.results || data;
    },
    enabled: isSuperuser,
  });

  const form = useForm({
    resolver: zodResolver(tenantSchema),
    defaultValues: { name: "", slug: "", plan: "standard", storage_quota_gb: 10 },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-tenants"] });

  const createTenant = useMutation({
    mutationFn: (payload) => api.post("/tenants/", payload),
    onSuccess: () => {
      toast.success("Tenant created");
      setDialogOpen(false);
      setError("");
      invalidate();
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || "Create failed");
    },
  });

  const updateTenant = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/tenants/${id}/`, payload),
    onSuccess: () => {
      toast.success("Tenant updated");
      setDialogOpen(false);
      setEditing(null);
      setError("");
      invalidate();
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || "Update failed");
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/tenants/${id}/`, { status }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "suspended"
          ? "Suspended — users notified; logins restricted after 24h"
          : "Tenant activated"
      );
      invalidate();
    },
    onError: () => toast.error("Status change failed"),
  });

  const deleteTenant = useMutation({
    mutationFn: (id) => api.delete(`/tenants/${id}/`),
    onSuccess: () => {
      toast.success("Tenant deleted");
      invalidate();
    },
    onError: () => toast.error("Delete failed — tenant may still have data"),
  });

  const openEdit = (t) => {
    setEditing(t);
    setError("");
    form.reset({
      name: t.name,
      slug: t.slug,
      plan: t.plan || "standard",
      storage_quota_gb: Math.max(1, Math.round((t.storage_quota_bytes || 0) / 1024 ** 3)),
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setError("");
    form.reset({ name: "", slug: "", plan: "standard", storage_quota_gb: 10 });
    setDialogOpen(true);
  };

  const onSubmit = (values) => {
    const payload = {
      name: values.name,
      plan: values.plan,
      storage_quota_bytes: Math.round(values.storage_quota_gb * 1024 ** 3),
    };
    if (editing) {
      updateTenant.mutate({ id: editing.id, payload });
    } else {
      createTenant.mutate({ ...payload, slug: values.slug, status: "active" });
    }
  };

  const list = tenants.data || [];
  const pendingCount = list.filter((t) => t.status === "pending").length;
  const suspendedCount = list.filter((t) => t.status === "suspended").length;

  if (user && !isSuperuser) {
    return (
      <AppShell title="Platform console">
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            The platform console is restricted to platform operators.
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Platform console"
      description="Provision universities, manage plans & quotas, and approve or suspend institutions. Superuser only."
      actions={
        <Button type="button" onClick={openCreate} className="h-9 shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tenant
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-3 text-xs">
        {[
          ["Total tenants", list.length],
          ["Pending approval", pendingCount],
          ["Suspended", suspendedCount],
        ].map(([label, value]) => (
          <span key={label} className="rounded-full border bg-card px-3 py-1.5 font-medium">
            {label}: <span className="text-primary">{value}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          Suspension notifies users immediately; logins lock after 24h (scheduled task)
        </span>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Provision a new tenant"}</DialogTitle>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution name</FormLabel>
                    <FormControl><Input {...field} placeholder="Abubakar Tafawa Balewa University" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="atbu" disabled={!!editing} />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">
                      Used in signup links{editing ? " — immutable once created" : ""}.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="standard">Standard</option>
                          <option value="professional">Professional</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storage_quota_gb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quota (GB)</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createTenant.isPending || updateTenant.isPending} className="shadow-sm">
                  {createTenant.isPending || updateTenant.isPending ? "Saving…" : editing ? "Save changes" : "Create tenant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {tenants.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load tenants</AlertDescription>
        </Alert>
      )}

      {tenants.isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Institution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead className="w-[260px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
                        {(t.name?.[0] || "?").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="truncate text-xs text-muted-foreground">/{t.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="capitalize">{t.plan}</TableCell>
                  <TableCell>{formatBytes(t.storage_quota_bytes)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {t.status === "pending" && (
                      <Button
                        type="button" size="sm"
                        onClick={() => setStatus.mutate({ id: t.id, status: "active" })}
                        disabled={setStatus.isPending}
                      >
                        Approve
                      </Button>
                    )}
                    {t.status !== "suspended" && t.status !== "pending" && (
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setStatus.mutate({ id: t.id, status: "suspended" })}
                        disabled={setStatus.isPending}
                      >
                        Suspend
                      </Button>
                    )}
                    {t.status === "suspended" && (
                      <Button
                        type="button" size="sm"
                        onClick={() => setStatus.mutate({ id: t.id, status: "active" })}
                        disabled={setStatus.isPending}
                      >
                        Reactivate
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(t)}>
                      Edit
                    </Button>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => {
                        if (window.confirm(`Delete “${t.name}”? This is irreversible.`))
                          deleteTenant.mutate(t.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    <Building2 className="mx-auto mb-2 h-6 w-6" aria-hidden />
                    No tenants yet — provision the first institution.
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
