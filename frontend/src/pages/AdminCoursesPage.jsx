import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { courseSchema } from "@/lib/validations";

export default function AdminCoursesPage() {
  return (
    <AdminCrudPage
      title="Courses"
      endpoint="/courses/"
      queryKey="admin-courses"
      schema={courseSchema}
      fields={[
        { name: "code", label: "Code", type: "text" },
        { name: "title", label: "Title", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "department", label: "Department", type: "select", optionsPath: "/departments/" },
        { name: "credit_unit", label: "Credit units", type: "number", defaultValue: 3 },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "active", label: "active" },
            { value: "inactive", label: "inactive" },
            { value: "archived", label: "archived" },
          ],
          defaultValue: "active",
        },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
