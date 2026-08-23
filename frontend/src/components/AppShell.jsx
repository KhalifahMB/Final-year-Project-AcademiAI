import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/courses", label: "Courses" },
  { to: "/resources", label: "Resources" },
  { to: "/chat", label: "AI Chat" },
  { to: "/quizzes", label: "Quizzes" },
];

export default function AppShell({ title, children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-700">
              AcademiAI
            </Link>
            <nav className="hidden sm:flex gap-1">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`text-sm px-3 py-1.5 rounded-lg ${
                    loc.pathname.startsWith(n.to)
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-slate-500 truncate max-w-[180px]">
              {user?.email} · {user?.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {title && <h1 className="text-2xl font-semibold text-slate-900 mb-4">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
