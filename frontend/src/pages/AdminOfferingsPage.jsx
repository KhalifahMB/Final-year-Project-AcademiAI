import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { offeringSchema } from "@/lib/validations";

export default function AdminOfferingsPage() {
  return (
    <AdminCrudPage
      title="Course offerings"
      endpoint="/course-offerings/"
      queryKey="course-offerings"
      schema={offeringSchema}
      fields={[
        { name: "course", label: "Course", type: "select", optionsPath: "/courses/" },
        { name: "academic_session", label: "Session", type: "select", optionsPath: "/academic-sessions/" },
        { name: "semester", label: "Semester", type: "select", optionsPath: "/semesters/" },
        {
          name: "status",
          label: "Status",
          type: "select",
          defaultValue: "active",
          options: [
            { value: "planned", label: "planned" },
            { value: "active", label: "active" },
            { value: "completed", label: "completed" },
            { value: "cancelled", label: "cancelled" },
          ],
        },
      ]}
      columns={[
        {
          key: "course",
          label: "Course",
          render: (r) =>
            r.course_code ? `${r.course_code} — ${r.course_title || ""}` : r.course,
        },
        { key: "session_name", label: "Session" },
        { key: "semester_name", label: "Semester" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
