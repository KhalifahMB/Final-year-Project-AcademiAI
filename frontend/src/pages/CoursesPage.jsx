import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function CoursesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/courses/");
        setItems(data.results || data);
      } catch (err) {
        setError(err.response?.data?.error?.detail || "Failed to load courses");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Link to="/dashboard" className="text-indigo-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="font-semibold">Courses</h1>
        </div>
        <span className="text-sm text-slate-500">{user?.email}</span>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        {error && <p className="text-red-600 text-sm mb-4">{String(error)}</p>}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="font-medium">{c.code ? `${c.code} — ${c.title}` : c.title}</div>
                {c.description && (
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2">{c.description}</p>
                )}
              </li>
            ))}
            {items.length === 0 && (
              <p className="text-slate-500 text-sm text-center">No courses yet.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
