import { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  BookOpenCheck,
  Bot,
  CircleAlert,
  FileText,
  GraduationCap,
  Link2,
  Sparkles,
} from "lucide-react";

const SUGGESTIONS = [
  "Summarize the key ideas from my course materials.",
  "Explain a concept I'm stuck on, step by step.",
  "What topics are likely to be examined?",
];

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const sources = msg.sources || [];

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
        aria-hidden
      >
        {isUser ? (
          <GraduationCap className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[75%]",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm border bg-card"
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {!isUser && sources.length > 0 ? (
          <div className="mt-3 border-t pt-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <BookOpenCheck className="h-3 w-3" aria-hidden /> Sources
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {sources.map((s, i) => (
                <li
                  key={s.id || i}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  title={`Retrieved via ${s.retrieval_method || "hybrid"} · rank ${s.rank ?? i + 1}`}
                >
                  <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    Source {s.rank ?? i + 1}
                    {s.retrieval_method ? ` · ${s.retrieval_method}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const { data } = await api.post("/chat/sessions/", { title: "Study chat" });
    setSessionId(data.id);
    return data.id;
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setError("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, role: "user", content },
    ]);
    setInput("");
    try {
      const sid = await ensureSession();
      const { data } = await api.post(`/chat/sessions/${sid}/messages/`, { content });
      setMessages((m) => [...m.slice(0, -1), data.user_message, data.assistant_message]);
    } catch (err) {
      setMessages((m) => m.filter((x) => !String(x.id).startsWith("local-")));
      setMessages((m) => [...m]);
      setInput(content);
      setError(err.response?.data?.error?.detail || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="AI Assistant"
      description="Answers are grounded exclusively in resources you're authorized to access."
    >
      <div className="flex h-[calc(100vh-14rem)] min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 chat-scroll">
            <EmptyState
              icon={Sparkles}
              title="Ask anything about your courses"
              description="The assistant retrieves relevant passages from authorized materials and cites them."
            />
            <div className="mx-auto mt-6 grid w-full max-w-xl gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={loading}
                  className="group flex items-center gap-2.5 rounded-lg border bg-background px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-5 chat-scroll" role="log" aria-live="polite">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading ? (
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                  <Bot className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border bg-card px-4 py-3.5 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}

        {error ? (
          <div className="px-5 pb-2">
            <Alert variant="destructive">
              <CircleAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t bg-background/60 p-3.5"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about your courses…  (Enter to send, Shift+Enter for a new line)"
              rows={1}
              disabled={loading}
              aria-label="Message"
              className="max-h-36 min-h-[44px] flex-1 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
            >
              <ArrowUp className="h-4.5 w-4.5" aria-hidden />
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
