import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { semesterSchema } from "@/lib/validations";

export default function AdminSemestersPage() {
  return (
    <AdminCrudPage
      title="Semesters"
      endpoint="/semesters/"
      queryKey="semesters"
      schema={semesterSchema}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "academic_session", label: "Session", type: "select", optionsPath: "/academic-sessions/" },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "academic_session", label: "Session" },
        { key: "start_date", label: "Start" },
        { key: "end_date", label: "End" },
      ]}
    />
  );
}
