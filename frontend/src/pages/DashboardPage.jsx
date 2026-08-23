import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const cards = [
  { to: "/courses", title: "Courses", desc: "View and manage course offerings" },
  { to: "/resources", title: "Resources", desc: "Upload and search academic materials" },
  { to: "/chat", title: "AI Assistant", desc: "Grounded Q&A over your resources" },
  { to: "/quizzes", title: "Quizzes", desc: "Practice and AI-generated assessments" },
  { to: "/verify-email", title: "Verify email", desc: "Enter the code sent to your inbox" },
];

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <p className="text-slate-600 mb-6">
        Your institution-scoped academic AI workspace.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-indigo-300 transition"
          >
            <h3 className="font-semibold text-slate-900">{c.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
