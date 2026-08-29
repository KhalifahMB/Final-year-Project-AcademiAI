import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardList, Pencil, Plus, Trash2, Users } from "lucide-react";

const toList = (d) => d?.results || d || [];

export default function CourseManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addOffering, setAddOffering] = useState(false);
  const [addEnrollment, setAddEnrollment] = useState(false);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);
  const [confirmRemoveEnrollment, setConfirmRemoveEnrollment] = useState(null); // enrollment object
  const [modalError, setModalError] = useState("");

  const courseQ = useQuery({
    queryKey: ["course", id],
    queryFn: async () => (await api.get(`/courses/${id}/`)).data,
    enabled: !!id,
  });
  const course = courseQ.data;

  const deptQ = useQuery({
    queryKey: ["department", course?.department],
    queryFn: async () => (await api.get(`/departments/${course.department}/`)).data,
    enabled: !!course?.department,
  });

  const offeringsQ = useQuery({
    queryKey: ["offerings", "course", id],
    queryFn: async () => toList((await api.get(`/course-offerings/?course=${id}`)).data),
    enabled: !!id,
  });

  const enrollmentsQ = useQuery({
    queryKey: ["enrollments", "course", id],
    queryFn: async () =>
      toList((await api.get(`/course-enrollments/?course_offering__course=${id}&page_size=200`)).data),
    enabled: !!id,
  });

  const sessionsQ = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => toList((await api.get("/academic-sessions/")).data),
  });
  const semestersQ = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => toList((await api.get("/semesters/?page_size=200")).data),
  });
  const studentsQ = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => toList((await api.get("/auth/users/?role=student&page_size=200")).data),
    enabled: addEnrollment,
  });

  const errText = (err, fallback) =>
    err?.response?.data?.error?.detail ||
    err?.response?.data?.detail ||
    fallback;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["course", id] });
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["offerings", "course", id] });
    qc.invalidateQueries({ queryKey: ["enrollments", "course", id] });
  };

  const saveCourse = useMutation({
    mutationFn: (payload) => api.patch(`/courses/${id}/`, payload),
    onSuccess: () => {
      toast.success("Course updated");
      setEditOpen(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Update failed")),
  });

  const createOffering = useMutation({
    mutationFn: (payload) => api.post("/course-offerings/", { ...payload, course: id, status: "active" }),
    onSuccess: () => {
      toast.success("Offering created — students of this department were auto-enrolled");
      setAddOffering(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Could not create offering")),
  });

  const createEnrollment = useMutation({
    mutationFn: (payload) => api.post("/course-enrollments/", payload),
    onSuccess: () => {
      toast.success("Student enrolled");
      setAddEnrollment(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Could not enroll student")),
  });

  const removeEnrollment = useMutation({
    mutationFn: (enrollmentId) => api.delete(`/course-enrollments/${enrollmentId}/`),
    onSuccess: () => {
      toast.success("Enrollment removed");
      setConfirmRemoveEnrollment(null);
      invalidate();
    },
    onError: () => toast.error("Could not remove enrollment"),
  });

  const deleteCourse = useMutation({
    mutationFn: () => api.delete(`/courses/${id}/`),
    onSuccess: () => {
      toast.success("Course deleted");
      qc.invalidateQueries({ queryKey: ["courses"] });
      navigate(-1);
    },
    onError: (e) => toast.error(errText(e, "Delete failed")),
  });

  const sessionName = (sid) => (sessionsQ.data || []).find((s) => s.id === sid)?.name || "—";
  const semesterName = (sid) => (semestersQ.data || []).find((s) => s.id === sid)?.name || "—";

  return (
    <AppShell
      title={course ? `${course.code} — ${course.title}` : "Course"}
      description={course ? `${course.credit_unit} credits · ${deptQ.data?.name || ""}` : undefined}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => { setModalError(""); setEditOpen(true); }}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-500/40 text-red-700 hover:bg-[var(--danger)]/10 dark:text-red-400"
            onClick={() => setConfirmDeleteCourse(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </>
      }
    >
      {course?.department && (
        <Link to={`/admin/departments/${course.department}`} className="mb-4 inline-block text-sm text-primary hover:underline">
          ← Department
        </Link>
      )}

      <div className="space-y-6">
        {/* Offerings */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-4.5 w-4.5 text-primary" aria-hidden /> Offerings
              </CardTitle>
              <CardDescription>
                A course runs per session/semester. Creating an offering auto-enrolls students of the department.
              </CardDescription>
            </div>
            <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(""); setAddOffering(true); }}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New offering
            </Button>
          </CardHeader>
          <CardContent>
            {offeringsQ.isLoading ? (
              <SkeletonRows rows={2} />
            ) : (offeringsQ.data || []).length === 0 ? (
              <EmptyState icon={ClipboardList} title="No offerings yet" description="Create an offering so students can be enrolled and materials attached." />
            ) : (
              <ul className="space-y-2">
                {(offeringsQ.data || []).map((o) => {
                  const count = (enrollmentsQ.data || []).filter((e) => e.course_offering === o.id).length;
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {sessionName(o.academic_session)} · {semesterName(o.semester)}
                        </p>
                        <p className="text-xs text-muted-foreground">{count} enrolled</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{o.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Enrollments */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-4.5 w-4.5 text-primary" aria-hidden /> Enrollments
              </CardTitle>
              <CardDescription>Students taking this course, across all offerings.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shadow-sm"
              disabled={(offeringsQ.data || []).length === 0}
              onClick={() => { setModalError(""); setAddEnrollment(true); }}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Enroll student
            </Button>
          </CardHeader>
          <CardContent>
            {enrollmentsQ.isLoading ? (
              <SkeletonRows rows={3} />
            ) : (enrollmentsQ.data || []).length === 0 ? (
              <EmptyState
                icon={Users}
                title="No enrollments"
                description={
                  (offeringsQ.data || []).length === 0
                    ? "Create an offering first — then enroll students or let auto-enrollment handle it."
                    : "Enroll students manually or create an offering to auto-enroll the department."
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Student</TableHead>
                      <TableHead>Offering</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[90px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enrollmentsQ.data || []).map((e) => {
                      const offering = (offeringsQ.data || []).find((o) => o.id === e.course_offering);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <p className="font-medium">{e.student_name || e.student_email}</p>
                            <p className="text-xs text-muted-foreground">{e.student_email}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {offering
                              ? `${sessionName(offering.academic_session)} · ${semesterName(offering.semester)}`
                              : "—"}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{e.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-[var(--danger)]/10 hover:text-red-700"
                              onClick={() => setConfirmRemoveEnrollment(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EntityDialog
        open={editOpen}
        title="Edit course"
        fields={[
          { name: "code", label: "Course code", required: true },
          { name: "title", label: "Title", required: true },
          { name: "credit_unit", label: "Credit units", type: "number" },
          { name: "description", label: "Description", type: "textarea" },
          {
            name: "status", label: "Status", type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
        initial={course}
        pending={saveCourse.isPending}
        error={modalError}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => saveCourse.mutate(payload)}
      />
      <EntityDialog
        open={addOffering}
        title="New course offering"
        fields={[
          {
            name: "academic_session", label: "Session", type: "select", required: true,
            options: (sessionsQ.data || []).map((s) => ({
              value: s.id, label: s.is_current ? `${s.name} (current)` : s.name,
            })),
          },
          {
            name: "semester", label: "Semester", type: "select", required: true,
            options: (semestersQ.data || []).map((s) => ({
              value: s.id,
              label: `${s.name}${s.is_current ? " (current)" : ""} — ${s.session_name || ""}`,
            })),
          },
        ]}
        pending={createOffering.isPending}
        error={modalError}
        onClose={() => setAddOffering(false)}
        onSubmit={(payload) => createOffering.mutate(payload)}
      />
      <EntityDialog
        open={addEnrollment}
        title="Enroll student"
        fields={[
          {
            name: "course_offering", label: "Offering", type: "select", required: true,
            options: (offeringsQ.data || []).map((o) => ({
              value: o.id, label: `${sessionName(o.academic_session)} · ${semesterName(o.semester)}`,
            })),
          },
          {
            name: "student", label: "Student", type: "select", required: true,
            options: (studentsQ.data || []).map((u) => ({
              value: u.id, label: u.full_name ? `${u.full_name} (${u.email})` : u.email,
            })),
          },
          {
            name: "status", label: "Status", type: "select",
            defaultValue: "enrolled",
            options: [
              { value: "enrolled", label: "Enrolled" },
              { value: "dropped", label: "Dropped" },
              { value: "completed", label: "Completed" },
            ],
          },
        ]}
        pending={createEnrollment.isPending}
        error={modalError}
        onClose={() => setAddEnrollment(false)}
        onSubmit={(payload) => {
          if (!payload.status) delete payload.status;
          createEnrollment.mutate(payload);
        }}
      />

      {/* Delete course confirmation */}
      <ConfirmDialog
        open={confirmDeleteCourse}
        title={`Delete ${course?.code || "this course"}?`}
        description="All offerings and enrollments for this course will be permanently removed. This action cannot be undone."
        confirmLabel="Delete course"
        destructive
        onConfirm={() => {
          setConfirmDeleteCourse(false);
          deleteCourse.mutate();
        }}
        onCancel={() => setConfirmDeleteCourse(false)}
      />

      {/* Remove enrollment confirmation */}
      <ConfirmDialog
        open={!!confirmRemoveEnrollment}
        title="Remove enrollment?"
        description={`Remove ${confirmRemoveEnrollment?.student_email || "this student"} from this course?`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          const id = confirmRemoveEnrollment?.id;
          setConfirmRemoveEnrollment(null);
          removeEnrollment.mutate(id);
        }}
        onCancel={() => setConfirmRemoveEnrollment(null)}
      />
    </AppShell>
  );
}
