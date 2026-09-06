import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import StatusBadge from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import {
  Building2, CalendarRange, CalendarDays, ChevronRight, Plus,
} from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  const mb = 1024 ** 2;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

const toList = (d) => d?.results || d || [];

export default function TenantStructurePage() {
  const qc = useQueryClient();
  const [addFaculty, setAddFaculty] = useState(false);
  const [addSession, setAddSession] = useState(false);
  const [editSession, setEditSession] = useState(null); // session object
  const [addSemester, setAddSemester] = useState(null); // session object
  const [editSemester, setEditSemester] = useState(null); // semester object
  const [modalError, setModalError] = useState("");

  const tenantQ = useQuery({
    queryKey: ["my-tenant"],
    queryFn: async () => {
      const { data } = await api.get("/tenants/");
      const t = toList(data);
      return Array.isArray(t) ? t[0] : t;
    },
  });
  const tenant = tenantQ.data;

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => toList((await api.get("/faculties/")).data),
  });

  const sessionsQ = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => toList((await api.get("/academic-sessions/")).data),
  });

  const semestersQ = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => toList((await api.get("/semesters/?page_size=200")).data),
  });

  const errText = (err, fallback) =>
    err?.response?.data?.error?.detail ||
    err?.response?.data?.detail ||
    (typeof err?.response?.data === "object"
      ? Object.values(err.response.data).flat().join(" ")
      : "") ||
    fallback;

  // --- mutations ------------------------------------------------------
  const createFaculty = useMutation({
    mutationFn: (payload) => api.post("/faculties/", payload),
    onSuccess: () => {
      toast.success("Faculty added");
      setAddFaculty(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["faculties"] });
    },
    onError: (e) => setModalError(errText(e, "Could not add faculty")),
  });

  const createSession = useMutation({
    mutationFn: (payload) => api.post("/academic-sessions/", payload),
    onSuccess: () => {
      toast.success("Session added");
      setAddSession(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["academic-sessions"] });
    },
    onError: (e) => setModalError(errText(e, "Could not add session")),
  });

  const createSemester = useMutation({
    mutationFn: (payload) => api.post("/semesters/", payload),
    onSuccess: () => {
      toast.success("Semester added");
      setAddSemester(null);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (e) => setModalError(errText(e, "Could not add semester")),
  });

  const updateSession = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/academic-sessions/${id}/`, payload),
    onSuccess: () => {
      toast.success("Session updated");
      setEditSession(null);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["academic-sessions"] });
    },
    onError: (e) => setModalError(errText(e, "Could not update session")),
  });

  const updateSemester = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/semesters/${id}/`, payload),
    onSuccess: () => {
      toast.success("Semester updated");
      setEditSemester(null);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (e) => setModalError(errText(e, "Could not update semester")),
  });

  const setCurrentSession = useMutation({
    mutationFn: (s) => api.patch(`/academic-sessions/${s.id}/`, { is_current: true }),
    onSuccess: () => {
      toast.success("Current session updated");
      qc.invalidateQueries({ queryKey: ["academic-sessions"] });
    },
    onError: (e) => toast.error(errText(e, "Could not set current session")),
  });

  const setCurrentSemester = useMutation({
    mutationFn (s) {
      return api.patch(`/semesters/${s.id}/`, { is_current: true });
    },
    onSuccess: () => {
      toast.success("Current semester updated");
      qc.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (e) => toast.error(errText(e, "Could not set current semester")),
  });

  const currentSession = (sessionsQ.data || []).find((s) => s.is_current);
  const currentSemester = (semestersQ.data || []).find((s) => s.is_current);

  return (
    <AppShell
      title="Institution"
      description="Your institution's profile, academic calendar, and faculty structure."
    >
      {tenantQ.isLoading ? (
        <SkeletonRows rows={3} />
      ) : tenantQ.error ? (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription className="flex w-full items-center justify-between gap-3">
            <span>Failed to load institution data</span>
            <Button type="button" variant="outline" size="sm" onClick={() => tenantQ.refetch()} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Profile summary */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-5 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{tenant?.name}</p>
                  <p className="text-xs text-muted-foreground">/{tenant?.slug}</p>
                </div>
              </div>
              <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={tenant?.status} /></div>
              <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium capitalize">{tenant?.plan || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Storage</p><p className="font-medium">{formatBytes(tenant?.storage_quota_bytes)}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">Current session</p>
                <p className="font-medium">{currentSession?.name || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current semester</p>
                <p className="font-medium">{currentSemester?.name || "Not set"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Academic calendar */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarRange className="h-4.5 w-4.5 text-primary" aria-hidden /> Academic calendar
                </CardTitle>
                <CardDescription>Sessions and their semesters. The current session/semester drives offerings.</CardDescription>
              </div>
              <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(""); setAddSession(true); }}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add session
              </Button>
            </CardHeader>
            <CardContent>
              {sessionsQ.isLoading ? (
                <SkeletonRows rows={2} />
              ) : sessionsQ.error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
                    <span>Failed to load sessions</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => sessionsQ.refetch()} className="h-7 shrink-0 text-[11px]">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (sessionsQ.data || []).length === 0 ? (
                <EmptyState icon={CalendarRange} title="No sessions yet" description="Add your first academic session, e.g. 2025/2026." />
              ) : (
                <ul className="space-y-2.5">
                  {(sessionsQ.data || []).map((s) => {
                    const sems = (semestersQ.data || []).filter((m) => m.academic_session === s.id);
                    return (
                      <li key={s.id} className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              {s.name}
                              {s.is_current ? <Badge>Current</Badge> : null}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {s.start_date} → {s.end_date}
                            </p>
                          </div>
                          {!s.is_current && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentSession.mutate(s)} disabled={setCurrentSession.isPending}>
                              Set current
                            </Button>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={() => { setModalError(""); setEditSession(s); }}>
                            Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setModalError(""); setAddSemester(s); }}>
                            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Semester
                          </Button>
                        </div>
                        {sems.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                            {sems.map((m) => (
                              <span key={m.id} className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                {m.name}
                                <span className="text-muted-foreground">({m.start_date} → {m.end_date})</span>
                                {m.is_current ? (
                                  <Badge className="px-1.5 py-0 text-[10px]">Current</Badge>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setCurrentSemester.mutate(m)}
                                    className="text-[11px] font-medium text-primary hover:underline"
                                  >
                                    set current
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { setModalError(""); setEditSemester(m); }}
                                  className="text-[11px] font-medium text-muted-foreground hover:text-primary hover:underline"
                                >
                                  edit
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Faculties */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-4.5 w-4.5 text-primary" aria-hidden /> Faculties
                </CardTitle>
                <CardDescription>Top-level academic units — open a faculty to manage its departments.</CardDescription>
              </div>
              <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(""); setAddFaculty(true); }}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add faculty
              </Button>
            </CardHeader>
            <CardContent>
              {facultiesQ.isLoading ? (
                <SkeletonRows rows={3} />
              ) : facultiesQ.error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
                    <span>Failed to load faculties</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => facultiesQ.refetch()} className="h-7 shrink-0 text-[11px]">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (facultiesQ.data || []).length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No faculties yet"
                  description="Faculties group departments. Add your first faculty to start building the structure."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(facultiesQ.data || []).map((f) => (
                    <li key={f.id}>
                      <Link
                        to={`/admin/faculties/${f.id}`}
                        className="card-surface card-surface-hover group flex items-center gap-3.5 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {(f.code || f.name || "?").slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">Code {f.code}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <EntityDialog
        open={addFaculty}
        title="Add faculty"
        fields={[
          { name: "name", label: "Faculty name", required: true, placeholder: "e.g. Faculty of Engineering" },
          { name: "code", label: "Code", required: true, placeholder: "e.g. ENG" },
        ]}
        pending={createFaculty.isPending}
        error={modalError}
        onClose={() => setAddFaculty(false)}
        onSubmit={(payload) => createFaculty.mutate(payload)}
      />
      <EntityDialog
        open={addSession}
        title="Add academic session"
        fields={[
          { name: "name", label: "Session name", required: true, placeholder: "e.g. 2025/2026" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          { name: "end_date", label: "End date", type: "date", required: true },
          { name: "is_current", label: "Set as current session", type: "select", options: [{ value: "true", label: "Yes" }, { value: "", label: "No" }] },
        ]}
        pending={createSession.isPending}
        error={modalError}
        onClose={() => setAddSession(false)}
        onSubmit={(payload) => {
          if (payload.is_current === "true") payload.is_current = true;
          else delete payload.is_current;
          createSession.mutate(payload);
        }}
      />
      <EntityDialog
        open={!!addSemester}
        title={`Add semester — ${addSemester?.name || ""}`}
        fields={[
          { name: "name", label: "Semester name", required: true, placeholder: "e.g. First Semester" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          { name: "end_date", label: "End date", type: "date", required: true },
        ]}
        pending={createSemester.isPending}
        error={modalError}
        onClose={() => setAddSemester(null)}
        onSubmit={(payload) => createSemester.mutate({ ...payload, academic_session: addSemester?.id })}
      />
      <EntityDialog
        open={!!editSession}
        title={`Edit session — ${editSession?.name || ""}`}
        fields={[
          { name: "name", label: "Session name", required: true, placeholder: "e.g. 2025/2026" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          { name: "end_date", label: "End date", type: "date", required: true },
        ]}
        initial={editSession || undefined}
        pending={updateSession.isPending}
        error={modalError}
        onClose={() => setEditSession(null)}
        onSubmit={(payload) => updateSession.mutate({ id: editSession?.id, ...payload })}
      />
      <EntityDialog
        open={!!editSemester}
        title={`Edit semester — ${editSemester?.name || ""}`}
        fields={[
          { name: "name", label: "Semester name", required: true, placeholder: "e.g. First Semester" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          { name: "end_date", label: "End date", type: "date", required: true },
        ]}
        initial={editSemester || undefined}
        pending={updateSemester.isPending}
        error={modalError}
        onClose={() => setEditSemester(null)}
        onSubmit={(payload) => updateSemester.mutate({ id: editSemester?.id, ...payload })}
      />
    </AppShell>
  );
}
