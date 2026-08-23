import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { programmeSchema } from "@/lib/validations";

export default function AdminProgrammesPage() {
  return (
    <AdminCrudPage
      title="Programmes"
      endpoint="/programmes/"
      queryKey="programmes"
      schema={programmeSchema}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "code", label: "Code", type: "text" },
        { name: "department", label: "Department", type: "select", optionsPath: "/departments/" },
        { name: "degree_type", label: "Degree type", type: "text" },
        { name: "duration_years", label: "Duration (years)", type: "number", defaultValue: 4 },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "department", label: "Department" },
      ]}
    />
  );
}
