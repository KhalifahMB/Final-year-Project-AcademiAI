import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";

const cards = [
  { to: "/courses", title: "Courses", desc: "View and manage course offerings" },
  { to: "/resources", title: "Resources", desc: "Upload and search academic materials" },
  { to: "/chat", title: "AI Assistant", desc: "Grounded Q&A over your resources" },
  { to: "/quizzes", title: "Quizzes", desc: "Practice and AI-generated assessments" },
  { to: "/verify-email", title: "Verify email", desc: "Enter the code sent to your inbox" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-700">AcademiAI</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user?.email} ({user?.role})
          </span>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">Dashboard</h2>
        <p className="text-slate-600 mb-6">
          Welcome{user?.first_name ? `, ${user.first_name}` : ""}. Your institution-scoped
          academic AI workspace is ready.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-indigo-300"
            >
              <h3 className="font-semibold text-slate-900">{c.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
