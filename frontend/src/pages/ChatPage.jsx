import { useState } from "react";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ChatPage() {
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
      const { data } = await api.post(`/chat/sessions/${sid}/messages/`, { content: input.trim() });
      setMessages((m) => [...m, data.user_message, data.assistant_message]);
      setInput("");
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="AI Assistant">
      <div className="flex flex-col gap-3 max-w-3xl">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ask a question grounded in your authorized course resources.
          </p>
        )}
        {messages.map((msg) => (
          <Card key={msg.id} className={msg.role === "user" ? "ml-8 border-primary/30" : "mr-8"}>
            <CardContent className="py-3 text-sm whitespace-pre-wrap">{msg.content}</CardContent>
          </Card>
        ))}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={send} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your courses…"
            rows={2}
            disabled={loading}
            className="flex-1"
            aria-label="Message"
          />
          <Button type="submit" disabled={loading}>{loading ? "…" : "Send"}</Button>
        </form>
      </div>
    </AppShell>
  );
}
