import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { facultySchema } from "@/lib/validations";

export default function AdminFacultiesPage() {
  return (
    <AdminCrudPage
      title="Faculties"
      endpoint="/faculties/"
      queryKey="faculties"
      schema={facultySchema}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "code", label: "Code", type: "text" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
      ]}
    />
  );
}
