import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  BookOpenCheck,
  Bot,
  CircleAlert,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

const SUGGESTIONS = [
  "Summarize the key ideas from my course materials.",
  "Explain a concept I'm stuck on, step by step.",
  "What topics are likely to be examined?",
];

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const sources = msg.sources || [];
  const isSummary = msg.kind === "summary";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : isSummary
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-accent text-accent-foreground"
        )}
        aria-hidden
      >
        {isUser ? <GraduationCap className="h-4 w-4" /> : isSummary ? <FileText className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[75%]",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm border bg-card"
        )}
      >
        {msg.title ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
            {msg.title}
          </p>
        ) : null}
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

function MaterialPicker({ open, onClose, onPick }) {
  const [resources, setResources] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setResources(null);
    setError("");
    api
      .get("/resources/?page_size=100")
      .then(({ data }) => setResources(data.results || data))
      .catch(() => setError("Could not load your materials."));
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-lg" role="dialog" aria-label="Pick a material to summarize">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
        <p className="text-sm font-medium">Summarize a material</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto chat-scroll p-1.5">
        {error ? (
          <li className="px-3 py-6 text-center text-sm text-destructive">{error}</li>
        ) : resources === null ? (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </li>
        ) : resources.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No materials yet — upload one first.
          </li>
        ) : (
          resources.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r)}
                disabled={r.processing_status !== "ready"}
                title={
                  r.processing_status !== "ready"
                    ? `Still processing (${r.processing_status})`
                    : r.title
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs capitalize text-muted-foreground">
                    {r.visibility_scope} scope
                  </span>
                </span>
                <StatusBadge status={r.processing_status} />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  // Chat history
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const { data } = await api.get("/chat/sessions/?page_size=50");
      return data.results || data;
    },
  });

  const openSession = async (s) => {
    setPickerOpen(false);
    setError("");
    setSessionId(s.id);
    setSessionTitle(s.title || "Conversation");
    try {
      const { data } = await api.get(`/chat/messages/?session=${s.id}&page_size=100`);
      setMessages(data.results || data);
    } catch {
      setError("Could not load that conversation.");
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setSessionTitle("");
    setMessages([]);
    setPickerOpen(false);
    setError("");
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const { data } = await api.post("/chat/sessions/", { title: "New chat" });
    setSessionId(data.id);
    refetchSessions();
    return data.id;
  };

  const pushMessage = (msg) => setMessages((m) => [...m, msg]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setError("");
    setLoading(true);
    const localId = `local-${Date.now()}`;
    pushMessage({ id: localId, role: "user", content });
    setInput("");
    try {
      const sid = await ensureSession();
      const { data } = await api.post(`/chat/sessions/${sid}/messages/`, { content });
      setMessages((m) => [...m.filter((x) => x.id !== localId), data.user_message, data.assistant_message]);
      setSessionTitle((t) => t || content.slice(0, 60));
      refetchSessions();
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== localId));
      setInput(content);
      setError(err.response?.data?.error?.detail || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ask the AI to summarize a specific material. Dispatches the async
   * summarize job and polls it; the result appears as an assistant message.
   */
  const summarizeMaterial = async (resource) => {
    setPickerOpen(false);
    setError("");
    setSummarizing(true);

    pushMessage({
      id: `ref-${resource.id}-${Date.now()}`,
      role: "user",
      title: "Material reference",
      content: `Please summarize “${resource.title}” for me.`,
    });

    const summaryId = `summary-${resource.id}-${Date.now()}`;
    pushMessage({
      id: summaryId,
      kind: "summary",
      title: `Summarizing “${resource.title}”…`,
      content: "Reading the material and drafting a summary.",
    });

    try {
      const { data: job } = await api.post(`/resources/${resource.id}/summarize/`);

      // Poll until the job completes (bounded ~90 s).
      let result = null;
      let lastError = null;
      for (let i = 0; i < 45; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2000));
        // eslint-disable-next-line no-await-in-loop
        const poll = await api.get(`/jobs/${job.job_id}/`);
        const status = poll.data.status;
        if (status === "success") {
          result = poll.data.result;
          break;
        }
        if (status === "failure") {
          lastError = poll.data.error || "Summarization failed.";
          break;
        }
      }

      // Soft failures arrive as a successful job with status:"failed".
      const softError = result?.status === "failed" ? result.error : null;

      setMessages((m) =>
        m.map((msg) =>
          msg.id === summaryId
            ? result?.summary
              ? { ...msg, title: `Summary of “${resource.title}”`, content: result.summary }
              : {
                  ...msg,
                  title: `Summary of “${resource.title}”`,
                  content:
                    softError ||
                    lastError ||
                    "Summarization is taking longer than expected. Check back in Resources shortly.",
                }
            : msg
        )
      );
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === summaryId
            ? {
                ...msg,
                title: `Summary of “${resource.title}”`,
                content:
                  err.response?.data?.error?.detail ||
                  "Could not start summarization. Is the material still processing?",
              }
            : msg
        )
      );
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <AppShell
      title="AI Assistant"
      description="Answers are grounded exclusively in materials you're authorized to access. Use the file button to reference a material for summarization."
    >
      <div className="flex h-[calc(100vh-14rem)] min-h-[440px] gap-4">
        {/* History sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:flex">
          <div className="border-b p-2.5">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> New chat
            </button>
          </div>
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2 chat-scroll">
            {!sessions ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                Your conversations will appear here.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openSession(s)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                        s.id === sessionId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="block truncate">{s.title || "Untitled chat"}</span>
                      <span className="block truncate text-[11px] opacity-70">
                        {new Date(s.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Conversation */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          {sessionTitle ? (
            <div className="flex items-center justify-between border-b px-4 py-2">
              <p className="truncate text-sm font-medium">{sessionTitle}</p>
              <button
                type="button"
                onClick={startNewChat}
                className="text-xs font-medium text-primary hover:underline md:hidden"
              >
                New chat
              </button>
            </div>
          ) : null}
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
          className="relative border-t bg-background/60 p-3.5"
        >
          <MaterialPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={summarizeMaterial}
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              disabled={summarizing}
              aria-label="Reference a material to summarize"
              title="Reference a material to summarize"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                pickerOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                summarizing && "cursor-not-allowed opacity-50"
              )}
            >
              <FileText className="h-4.5 w-4.5" aria-hidden />
            </button>
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
          {summarizing ? (
            <p className="mt-2 flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Summarization job running…
            </p>
          ) : null}
        </form>
        </div>
      </div>
    </AppShell>
  );
}
