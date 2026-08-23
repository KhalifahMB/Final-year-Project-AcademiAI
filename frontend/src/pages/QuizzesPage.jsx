import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function QuizzesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/quizzes/");
      setItems(data.results || data);
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setError("");
    try {
      const { data } = await api.post("/quizzes/generate/", {
        num_questions: 5,
        title: "Practice quiz",
      });
      setJobId(data.job_id);
      setJobStatus({ status: data.status });
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Generate failed (lecturer/admin only)");
    }
  };

  const pollJob = async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/jobs/${jobId}/`);
      setJobStatus(data);
      if (data.status === "success" || data.successful) {
        await load();
      }
    } catch (err) {
      setError("Could not poll job");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Link to="/dashboard" className="text-indigo-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="font-semibold">Quizzes</h1>
        </div>
        <span className="text-sm text-slate-500">{user?.email}</span>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-4">
        {(user?.role === "lecturer" || user?.role === "admin") && (
          <div className="bg-white border rounded-xl p-4 flex gap-2 items-center">
            <button
              onClick={generate}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Generate quiz (AI)
            </button>
            {jobId && (
              <button onClick={pollJob} className="text-sm text-indigo-600 underline">
                Refresh job status
              </button>
            )}
            {jobStatus && (
              <span className="text-xs text-slate-500">
                Job: {jobStatus.status}
              </span>
            )}
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{String(error)}</p>}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((q) => (
              <li key={q.id} className="bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="font-medium">{q.title}</div>
                <div className="text-xs text-slate-500 mt-1">{q.status}</div>
              </li>
            ))}
            {items.length === 0 && (
              <p className="text-slate-500 text-sm text-center">No quizzes yet.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
