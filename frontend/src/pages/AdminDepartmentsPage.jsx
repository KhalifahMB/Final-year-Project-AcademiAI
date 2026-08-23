import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { departmentSchema } from "@/lib/validations";

export default function AdminDepartmentsPage() {
  return (
    <AdminCrudPage
      title="Departments"
      endpoint="/departments/"
      queryKey="departments"
      schema={departmentSchema}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "code", label: "Code", type: "text" },
        { name: "faculty", label: "Faculty", type: "select", optionsPath: "/faculties/" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "faculty", label: "Faculty" },
      ]}
    />
  );
}
