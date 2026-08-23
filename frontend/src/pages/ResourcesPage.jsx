import { useEffect, useState } from "react";
import api from "../services/api";
import AppShell from "../components/AppShell";
import Spinner from "../components/Spinner";

export default function ResourcesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
    setError("");
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

  const requestUpload = async (id) => {
    setBusyId(id);
    setError("");
    try {
      const { data } = await api.post(`/resources/${id}/request_upload_url/`, {
        content_type: "text/plain",
      });
      // Dev helper: show key; real clients PUT file to upload_url
      alert(`Presigned upload ready.\nKey: ${data.storage_key}\nPUT to upload_url then call complete_upload.`);
      console.info("upload", data);
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Upload URL failed");
    } finally {
      setBusyId(null);
    }
  };

  const summarize = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/resources/${id}/summarize/`);
      alert(`Summary job queued: ${data.job_id}`);
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Summarize failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Resources">
      <form onSubmit={createResource} className="flex gap-2 bg-white p-4 rounded-xl border mb-4">
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
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{String(error)}</div>
      )}
      {loading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="bg-white border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
            >
              <div>
                <div className="font-medium text-slate-900">{r.title}</div>
                <div className="text-slate-500 text-xs mt-1">
                  {r.processing_status} · {r.visibility_scope}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => requestUpload(r.id)}
                  className="text-xs px-2 py-1 border rounded-lg hover:bg-slate-50"
                >
                  Get upload URL
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => summarize(r.id)}
                  className="text-xs px-2 py-1 border rounded-lg hover:bg-slate-50"
                >
                  Summarize
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">No resources yet. Create one above.</p>
          )}
        </ul>
      )}
    </AppShell>
  );
}
