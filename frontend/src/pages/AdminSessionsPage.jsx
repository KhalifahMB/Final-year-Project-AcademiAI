import AdminCrudPage from "@/features/admin/AdminCrudPage";
import { sessionSchema } from "@/lib/validations";

export default function AdminSessionsPage() {
  return (
    <AdminCrudPage
      title="Academic sessions"
      endpoint="/academic-sessions/"
      queryKey="academic-sessions"
      schema={sessionSchema}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "start_date", label: "Start" },
        { key: "end_date", label: "End" },
        { key: "is_current", label: "Current" },
      ]}
    />
  );
}
