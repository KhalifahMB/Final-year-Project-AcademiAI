import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import StatusBadge from "@/components/shared/StatusBadge";
import StatCard from "@/components/shared/StatCard";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, CheckCircle, Edit, FileText,
  GraduationCap, HardDrive, Landmark, Pause, Play,
  Users, AlertTriangle,
} from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

const QUOTA_OPTIONS = [
  { value: String(5 * 1024 ** 3), label: "5 GB" },
  { value: String(10 * 1024 ** 3), label: "10 GB" },
  { value: String(50 * 1024 ** 3), label: "50 GB" },
  { value: String(100 * 1024 ** 3), label: "100 GB" },
  { value: String(500 * 1024 ** 3), label: "500 GB" },
];

const PLAN_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "pending", label: "Pending" },
];

const ROLE_STYLES = {
  admin: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
  lecturer: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
  student: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${ROLE_STYLES[role] || "bg-muted text-muted-foreground border-border"}`}>
      {role}
    </span>
  );
}

const errText = (e, fallback) =>
  e?.response?.data?.error?.detail ||
  e?.response?.data?.detail ||
  (typeof e?.response?.data === "object"
    ? Object.values(e.response.data).flat().join(" ")
    : "") ||
  fallback;

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [modalError, setModalError] = useState("");

  const detailQ = useQuery({
    queryKey: ["platform-tenant-detail", id],
    queryFn: async () => (await platformApi.tenantDetail(id)).data,
    staleTime: 30_000,
  });

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const { data } = await platformApi.tenants.list({ page_size: 500 });
      return data?.results || data || [];
    },
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-tenant-detail", id] });
    qc.invalidateQueries({ queryKey: ["platform-tenants"] });
  };

  const updateTenant = useMutation({
    mutationFn: (payload) => platformApi.tenants.update(id, payload),
    onSuccess: () => {
      toast.success("Tenant updated");
      setEditOpen(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Update failed")),
  });

  const setStatus = useMutation({
    mutationFn: (status) => platformApi.tenants.update(id, { status }),
    onSuccess: (_d, vars) => {
      toast.success(vars === "suspended" ? "Tenant suspended" : "Tenant reactivated");
      setSuspendTarget(null);
      setReactivateTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(errText(e, "Status update failed")),
  });

  const data = detailQ.data;
  const tenantData = data?.tenant;
  const stats = data?.stats;
  const tenantList = tenantsQ.data || [];
  const tenantFromList = tenantList.find((t) => t.id === id);

  return (
    <AppShell
      title={tenantData?.name || "Tenant Detail"}
      description={tenantData ? `/${tenantData.slug} · ${tenantData.plan} plan` : "Loading..."}
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/platform/tenants")}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> All tenants
          </Button>
          {tenantFromList && (
            <>
              <Button type="button" variant="outline" onClick={() => { setModalError(""); setEditOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" aria-hidden /> Edit
              </Button>
              {tenantFromList.status === "suspended" ? (
                <Button type="button" variant="outline" onClick={() => setReactivateTarget(tenantFromList)}>
                  <Play className="mr-2 h-4 w-4" aria-hidden /> Reactivate
                </Button>
              ) : (
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setSuspendTarget(tenantFromList)} disabled={tenantFromList.status !== "active"}>
                  <Pause className="mr-2 h-4 w-4" aria-hidden /> Suspend
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      {detailQ.isLoading ? (
        <SkeletonRows rows={6} />
      ) : detailQ.error ? (
        <Alert variant="destructive"><AlertDescription>Failed to load tenant details.</AlertDescription></Alert>
      ) : data ? (
        <div className="space-y-6">
          {/* ── Header Card ─────────────────────────────────────── */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-5 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{tenantData.name}</p>
                  <p className="text-xs text-muted-foreground">{tenantData.domain || "No domain"}</p>
                </div>
              </div>
              <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={tenantData.status} /></div>
              <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium capitalize">{tenantData.plan}</p></div>
              <div><p className="text-xs text-muted-foreground">Storage</p><p className="font-medium">{formatBytes(tenantData.storage_quota_bytes)}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{tenantData.created_at ? new Date(tenantData.created_at).toLocaleDateString() : "—"}</p></div>
            </CardContent>
          </Card>

          {/* ── Stats ───────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Users" value={stats?.users?.total} hint={`${stats?.users?.verified || 0} verified`} />
            <StatCard icon={FileText} label="Resources" value={stats?.resources?.total} hint={formatBytes(stats?.resources?.storage_used_bytes)} />
            <StatCard icon={GraduationCap} label="Enrollments" value={stats?.academic?.enrollments} hint={`${stats?.academic?.courses || 0} courses`} />
            <StatCard icon={Landmark} label="Faculties" value={stats?.academic?.faculties} hint={`${stats?.academic?.departments || 0} departments`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={Users} label="Chat Sessions" value={stats?.chat?.sessions} hint={`${stats?.chat?.messages || 0} messages`} />
            <StatCard icon={Users} label="Quiz Attempts" value={stats?.quizzes?.attempts} hint={`${stats?.quizzes?.total || 0} quizzes`} />
            <StatCard icon={HardDrive} label="Vector Chunks" value={stats?.resources?.chunks} hint="Embedded" />
          </div>

          {/* ── Users by Role ───────────────────────────────────── */}
          {stats?.users?.by_role && Object.keys(stats.users.by_role).length > 0 && (
            <Card>
              <CardContent className="py-5">
                <h3 className="text-sm font-semibold mb-3">Users by role</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.users.by_role).map(([role, count]) => (
                    <div key={role} className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                      <RoleBadge role={role} />
                      <span className="font-semibold text-sm">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Academic Structure ──────────────────────────────── */}
          {stats?.academic && (
            <Card>
              <CardContent className="py-5">
                <h3 className="text-sm font-semibold mb-3">Academic structure</h3>
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {[
                    { label: "Faculties", value: stats.academic.faculties },
                    { label: "Departments", value: stats.academic.departments },
                    { label: "Programmes", value: stats.academic.programmes },
                    { label: "Courses", value: stats.academic.courses },
                    { label: "Offerings", value: stats.academic.offerings },
                    { label: "Enrollments", value: stats.academic.enrollments },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <p className="text-xl font-bold tabular-nums">{item.value}</p>
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* ── Edit Dialog ──────────────────────────────────────────── */}
      <EntityDialog
        open={editOpen}
        title={`Edit — ${tenantFromList?.name || ""}`}
        fields={[
          { name: "name", label: "Institution name", required: true },
          { name: "domain", label: "Domain" },
          { name: "plan", label: "Plan", type: "select", options: PLAN_OPTIONS },
          { name: "storage_quota_bytes", label: "Storage quota", type: "select", options: QUOTA_OPTIONS },
          { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
        ]}
        initial={tenantFromList ? {
          name: tenantFromList.name,
          domain: tenantFromList.domain || "",
          plan: tenantFromList.plan || "standard",
          storage_quota_bytes: String(tenantFromList.storage_quota_bytes),
          status: tenantFromList.status,
        } : {}}
        pending={updateTenant.isPending}
        error={modalError}
        onClose={() => { setEditOpen(false); setModalError(""); }}
        onSubmit={(payload) => {
          if (payload.storage_quota_bytes) payload.storage_quota_bytes = Number(payload.storage_quota_bytes);
          updateTenant.mutate(payload);
        }}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        title={`Suspend ${suspendTarget?.name || "this institution"}?`}
        description="Users will lose the ability to log in after a 24-hour grace period."
        confirmLabel="Suspend"
        variant="destructive"
        icon={AlertTriangle}
        onConfirm={() => setStatus.mutate("suspended")}
        onCancel={() => setSuspendTarget(null)}
        pending={setStatus.isPending}
      />

      <ConfirmDialog
        open={!!reactivateTarget}
        title={`Reactivate ${reactivateTarget?.name || "this institution"}?`}
        description="All users will regain access immediately."
        confirmLabel="Reactivate"
        variant="default"
        icon={CheckCircle}
        onConfirm={() => setStatus.mutate("active")}
        onCancel={() => setReactivateTarget(null)}
        pending={setStatus.isPending}
      />
    </AppShell>
  );
}
