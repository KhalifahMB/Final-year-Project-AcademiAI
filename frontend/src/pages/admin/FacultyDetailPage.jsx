import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { toast } from "sonner";
import {
  Building2, ChevronRight, Pencil, Plus, Trash2,
} from "lucide-react";

const toList = (d) => d?.results || d || [];

export default function FacultyDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addDept, setAddDept] = useState(false);
  const [modalError, setModalError] = useState("");

  const facultyQ = useQuery({
    queryKey: ["faculty", id],
    queryFn: async () => (await api.get(`/faculties/${id}/`)).data,
    enabled: !!id,
  });
  const faculty = facultyQ.data;

  const departmentsQ = useQuery({
    queryKey: ["departments", "faculty", id],
    queryFn: async () => toList((await api.get(`/departments/?faculty=${id}`)).data),
    enabled: !!id,
  });

  const errText = (err, fallback) =>
    err?.response?.data?.error?.detail ||
    err?.response?.data?.detail ||
    fallback;

  const saveFaculty = useMutation({
    mutationFn: (payload) => api.patch(`/faculties/${id}/`, payload),
    onSuccess: () => {
      toast.success("Faculty updated");
      setEditOpen(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["faculty", id] });
      qc.invalidateQueries({ queryKey: ["faculties"] });
    },
    onError: (e) => setModalError(errText(e, "Update failed")),
  });

  const createDept = useMutation({
    mutationFn: (payload) => api.post("/departments/", { ...payload, faculty: id }),
    onSuccess: () => {
      toast.success("Department added");
      setAddDept(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["departments", "faculty", id] });
    },
    onError: (e) => setModalError(errText(e, "Could not add department")),
  });

  const deleteFaculty = useMutation({
    mutationFn: () => api.delete(`/faculties/${id}/`),
    onSuccess: () => {
      toast.success("Faculty deleted");
      qc.invalidateQueries({ queryKey: ["faculties"] });
      navigateBack();
    },
    onError: (e) => toast.error(errText(e, "Delete failed — it may still have departments")),
  });

  const navigateBack = () => window.history.back();

  return (
    <AppShell
      title={faculty?.name || "Faculty"}
      description={`Code ${faculty?.code || "—"}`}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => { setModalError(""); setEditOpen(true); }}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
            onClick={() => {
              if (window.confirm(`Delete ${faculty?.name}? Departments under it are removed too.`)) {
                deleteFaculty.mutate();
              }
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </>
      }
    >
      <Link to="/admin/tenant" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Institution
      </Link>

      {/* Departments */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Departments</CardTitle>
            <CardDescription>Open a department to manage its courses and programmes.</CardDescription>
          </div>
          <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(""); setAddDept(true); }}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add department
          </Button>
        </CardHeader>
        <CardContent>
          {departmentsQ.isLoading ? (
            <SkeletonRows rows={3} />
          ) : departmentsQ.error ? (
            <Alert variant="destructive"><AlertDescription>Failed to load departments</AlertDescription></Alert>
          ) : (departmentsQ.data || []).length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Add the first department under this faculty."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(departmentsQ.data || []).map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/admin/departments/${d.id}`}
                    className="group flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {(d.code || d.name || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">Code {d.code}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EntityDialog
        open={editOpen}
        title="Edit faculty"
        fields={[
          { name: "name", label: "Faculty name", required: true },
          { name: "code", label: "Code", required: true },
        ]}
        initial={faculty}
        pending={saveFaculty.isPending}
        error={modalError}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => saveFaculty.mutate(payload)}
      />
      <EntityDialog
        open={addDept}
        title="Add department"
        fields={[
          { name: "name", label: "Department name", required: true, placeholder: "e.g. Computer Science" },
          { name: "code", label: "Code", required: true, placeholder: "e.g. CS" },
        ]}
        pending={createDept.isPending}
        error={modalError}
        onClose={() => setAddDept(false)}
        onSubmit={(payload) => createDept.mutate(payload)}
      />
    </AppShell>
  );
}
