import { Link } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const cards = [
  { to: "/courses", title: "Courses", desc: "View course catalogue and offerings" },
  { to: "/resources", title: "Resources", desc: "Upload and manage academic materials" },
  { to: "/chat", title: "AI Assistant", desc: "Grounded Q&A over authorized resources" },
  { to: "/quizzes", title: "Quizzes", desc: "Practice and AI-generated assessments" },
  { to: "/notes", title: "Notes", desc: "Personal study notes" },
  { to: "/bookmarks", title: "Bookmarks", desc: "Saved resources" },
  { to: "/progress", title: "Progress", desc: "Learning progress records" },
  { to: "/profile", title: "Profile", desc: "Account settings" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <AppShell title={`Welcome${user?.first_name ? `, ${user.first_name}` : ""}`}>
      <p className="text-muted-foreground mb-6 text-sm">
        Institution-scoped academic AI workspace · role: <strong>{user?.role}</strong>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="block transition hover:opacity-90">
            <Card className="h-full hover:border-primary/40">
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
