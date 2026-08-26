import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { enrollmentSchema } from "@/lib/validations";

export default function AdminEnrollmentsPage() {
  return (
    <AdminCrudPage
      title="Enrollments"
      endpoint="/course-enrollments/"
      queryKey="course-enrollments"
      schema={enrollmentSchema}
      fields={[
        { name: "course_offering", label: "Offering", type: "select", optionsPath: "/course-offerings/" },
        { name: "student", label: "Student", type: "select", optionsPath: "/auth/users/" },
        {
          name: "status",
          label: "Status",
          type: "select",
          defaultValue: "enrolled",
          options: [
            { value: "enrolled", label: "enrolled" },
            { value: "dropped", label: "dropped" },
            { value: "completed", label: "completed" },
          ],
        },
      ]}
      columns={[
        { key: "student_name", label: "Student" },
        {
          key: "course_offering",
          label: "Offering",
          render: (r) =>
            r.offering_course_code
              ? `${r.offering_course_code} — ${r.offering_course_title || ""}`
              : r.course_offering,
        },
        {
          key: "session_name",
          label: "Session / Semester",
          render: (r) =>
            [r.semester_name, r.session_name].filter(Boolean).join(" · ") || "—",
        },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
