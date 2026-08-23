import { useEffect, useState } from "react";
import api from "../services/api";
import AppShell from "../components/AppShell";
import Spinner from "../components/Spinner";

export default function CoursesPage() {
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
    <AppShell title="Courses">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{String(error)}</div>}
      {loading ? (
        <Spinner />
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
            <p className="text-slate-500 text-sm text-center py-8">No courses yet.</p>
          )}
        </ul>
      )}
    </AppShell>
  );
}
