import { Link } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();
  const base = [
    { to: "/my-courses", title: "My courses", desc: "Your enrollments" },
    { to: "/my-programme", title: "My programme", desc: "Programme info" },
    { to: "/courses", title: "Course catalogue", desc: "Browse courses" },
    { to: "/resources", title: "Resources", desc: "Academic materials" },
    { to: "/chat", title: "AI Assistant", desc: "Grounded Q&A" },
    { to: "/quizzes", title: "Quizzes", desc: "Practice assessments" },
    { to: "/notes", title: "Notes", desc: "Personal notes" },
    { to: "/bookmarks", title: "Bookmarks", desc: "Saved resources" },
    { to: "/progress", title: "Progress", desc: "Learning progress" },
    { to: "/profile", title: "Profile", desc: "Account" },
  ];
  if (user?.role === "lecturer" || user?.role === "admin") {
    base.push(
      { to: "/assigned-courses", title: "Assigned courses", desc: "Lecturer assignments" },
      { to: "/resources/upload", title: "Upload resource", desc: "Presign + ingest" },
    );
  }
  if (user?.role === "admin") {
    base.push(
      { to: "/admin/users", title: "Users", desc: "Tenant users" },
      { to: "/admin/faculties", title: "Faculties", desc: "Structure" },
      { to: "/admin/departments", title: "Departments", desc: "Structure" },
      { to: "/admin/programmes", title: "Programmes", desc: "Structure" },
      { to: "/admin/courses", title: "Courses", desc: "Admin catalogue" },
      { to: "/admin/offerings", title: "Offerings", desc: "Sessions" },
      { to: "/admin/enrollments", title: "Enrollments", desc: "Students" },
      { to: "/admin/audit", title: "Audit logs", desc: "Security" },
      { to: "/admin/tenant", title: "Tenant", desc: "Settings" },
    );
  }
  return (
    <AppShell title={`Welcome${user?.first_name ? `, ${user.first_name}` : ""}`}>
      <p className="text-muted-foreground mb-6 text-sm">Role: <strong>{user?.role}</strong></p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {base.map((c) => (
          <Link key={c.to} to={c.to} className="block">
            <Card className="h-full hover:border-primary/40 transition">
              <CardHeader>
                <CardTitle className="text-lg">{c.title}</CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
