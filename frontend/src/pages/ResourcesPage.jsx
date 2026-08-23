import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function ResourcesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/resources/");
      setItems(data.results || data);
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Failed to load resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createResource = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.post("/resources/", { title: title.trim(), description: "" });
      setTitle("");
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Link to="/dashboard" className="text-indigo-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="font-semibold">Resources</h1>
        </div>
        <span className="text-sm text-slate-500">{user?.email}</span>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <form onSubmit={createResource} className="flex gap-2 bg-white p-4 rounded-xl border">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="New resource title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
        </form>
        {error && <p className="text-red-600 text-sm">{String(error)}</p>}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="bg-white border rounded-xl px-4 py-3 flex justify-between text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">{r.title}</div>
                  <div className="text-slate-500 text-xs mt-1">
                    {r.processing_status} · {r.visibility_scope}
                  </div>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <p className="text-slate-500 text-sm text-center">No resources yet.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
