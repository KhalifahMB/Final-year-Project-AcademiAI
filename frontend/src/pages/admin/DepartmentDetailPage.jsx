import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { toast } from "sonner";
import { BookOpen, ChevronRight, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";

const toList = (d) => d?.results || d || [];

export default function DepartmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addCourse, setAddCourse] = useState(false);
  const [addProgramme, setAddProgramme] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modalError, setModalError] = useState("");

  const deptQ = useQuery({
    queryKey: ["department", id],
    queryFn: async () => (await api.get(`/departments/${id}/`)).data,
    enabled: !!id,
  });
  const dept = deptQ.data;

  const coursesQ = useQuery({
    queryKey: ["courses", "dept", id],
    queryFn: async () => toList((await api.get(`/courses/?department=${id}`)).data),
    enabled: !!id,
  });

  const programmesQ = useQuery({
    queryKey: ["programmes", "dept", id],
    queryFn: async () => toList((await api.get(`/programmes/?department=${id}`)).data),
    enabled: !!id,
  });

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => toList((await api.get("/faculties/")).data),
  });

  const errText = (err, fallback) =>
    err?.response?.data?.error?.detail ||
    err?.response?.data?.detail ||
    fallback;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["department", id] });
    qc.invalidateQueries({ queryKey: ["departments"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["programmes"] });
  };

  const saveDept = useMutation({
    mutationFn: (payload) => api.patch(`/departments/${id}/`, payload),
    onSuccess: () => {
      toast.success("Department updated");
      setEditOpen(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Update failed")),
  });

  const createCourse = useMutation({
    mutationFn: (payload) => api.post("/courses/", { ...payload, department: id }),
    onSuccess: () => {
      toast.success("Course added");
      setAddCourse(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["courses", "dept", id] });
    },
    onError: (e) => setModalError(errText(e, "Could not add course")),
  });

  const createProgramme = useMutation({
    mutationFn: (payload) => api.post("/programmes/", { ...payload, department: id }),
    onSuccess: () => {
      toast.success("Programme added");
      setAddProgramme(false);
      setModalError("");
      qc.invalidateQueries({ queryKey: ["programmes", "dept", id] });
    },
    onError: (e) => setModalError(errText(e, "Could not add programme")),
  });

  const deleteDept = useMutation({
    mutationFn: () => api.delete(`/departments/${id}/`),
    onSuccess: () => {
      toast.success("Department deleted");
      qc.invalidateQueries({ queryKey: ["faculties"] });
      navigate(-1);
    },
    onError: (e) => toast.error(errText(e, "Delete failed — remove its courses/programmes first")),
  });

  const facultyName = (facultiesQ.data || []).find((f) => f.id === dept?.faculty)?.name;

  return (
    <AppShell
      title={dept?.name || "Department"}
      description={[`Code ${dept?.code || "—"}`, facultyName].filter(Boolean).join(" · ")}
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
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </>
      }
    >
      {dept?.faculty && (
        <Link to={`/admin/faculties/${dept.faculty}`} className="mb-4 inline-block text-sm text-primary hover:underline">
          ← Faculty
        </Link>
      )}

      <div className="space-y-6">
        {/* Courses */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Courses</CardTitle>
              <CardDescription>Open a course to manage its offerings and student enrollments.</CardDescription>
            </div>
            <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(""); setAddCourse(true); }}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add course
            </Button>
          </CardHeader>
          <CardContent>
            {coursesQ.isLoading ? (
              <SkeletonRows rows={3} />
            ) : (coursesQ.data || []).length === 0 ? (
              <EmptyState icon={BookOpen} title="No courses yet" description="Add the first course for this department." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {(coursesQ.data || []).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/admin/courses/${c.id}`}
                      className="card-surface card-surface-hover group flex items-center gap-3.5 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.code} — {c.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.credit_unit} credits · {c.status}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Programmes */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Programmes</CardTitle>
              <CardDescription>Degree programmes offered by this department — students pick one at signup.</CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" className="shadow-sm" onClick={() => { setModalError(""); setAddProgramme(true); }}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add programme
            </Button>
          </CardHeader>
          <CardContent>
            {programmesQ.isLoading ? (
              <SkeletonRows rows={2} />
            ) : (programmesQ.data || []).length === 0 ? (
              <EmptyState icon={GraduationCap} title="No programmes yet" description="e.g. BSc Computer Science." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {(programmesQ.data || []).map((p) => (
                  <li key={p.id} className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
                    <span className="font-medium">{p.code} — {p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.degree_type || "—"} · {p.duration_years}y
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <EntityDialog
        open={editOpen}
        title="Edit department"
        fields={[
          { name: "name", label: "Department name", required: true },
          { name: "code", label: "Code", required: true },
          {
            name: "faculty", label: "Faculty", type: "select", required: true,
            options: (facultiesQ.data || []).map((f) => ({ value: f.id, label: `${f.code} — ${f.name}` })),
          },
        ]}
        initial={dept}
        pending={saveDept.isPending}
        error={modalError}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => saveDept.mutate(payload)}
      />
      <EntityDialog
        open={addCourse}
        title="Add course"
        fields={[
          { name: "code", label: "Course code", required: true, placeholder: "e.g. CS501" },
          { name: "title", label: "Title", required: true, placeholder: "e.g. Database Systems" },
          { name: "credit_unit", label: "Credit units", type: "number", placeholder: "3" },
          { name: "description", label: "Description", type: "textarea" },
        ]}
        pending={createCourse.isPending}
        error={modalError}
        onClose={() => setAddCourse(false)}
        onSubmit={(payload) => createCourse.mutate(payload)}
      />
      <EntityDialog
        open={addProgramme}
        title="Add programme"
        fields={[
          { name: "name", label: "Programme name", required: true, placeholder: "e.g. Computer Science" },
          { name: "code", label: "Code", required: true, placeholder: "e.g. CSC" },
          { name: "degree_type", label: "Degree type", placeholder: "BSc, MSc…" },
          { name: "duration_years", label: "Duration (years)", type: "number", placeholder: "4" },
        ]}
        pending={createProgramme.isPending}
        error={modalError}
        onClose={() => setAddProgramme(false)}
        onSubmit={(payload) => createProgramme.mutate(payload)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${dept?.name || "this department"}?`}
        description="All courses and programmes in this department will also be permanently removed. This action cannot be undone."
        confirmLabel="Delete department"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          deleteDept.mutate();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppShell>
  );
}
