import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export default function ChatPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const { data } = await api.post("/chat/sessions/", { title: "Study chat" });
    setSessionId(data.id);
    return data.id;
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError("");
    setLoading(true);
    try {
      const sid = await ensureSession();
      const { data } = await api.post(`/chat/sessions/${sid}/messages/`, {
        content: input.trim(),
      });
      setMessages((m) => [
        ...m,
        data.user_message,
        data.assistant_message,
      ]);
      setInput("");
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-3 flex justify-between">
        <div className="flex gap-4 items-center">
          <Link to="/dashboard" className="text-indigo-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="font-semibold text-slate-900">AI Assistant</h1>
        </div>
        <span className="text-sm text-slate-500">{user?.email}</span>
      </header>
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center mt-12">
            Ask a question grounded in your authorized course resources.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-indigo-600 text-white ml-12"
                : "bg-white border border-slate-200 mr-12"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
      <form onSubmit={send} className="border-t bg-white p-4 max-w-3xl w-full mx-auto flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your courses…"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
