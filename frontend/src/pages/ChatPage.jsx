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
  Image,
  Link2,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Summarize the key ideas from my course materials.",
  "Explain a concept I'm stuck on, step by step.",
  "What topics are likely to be examined?",
];

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function ContentRenderer({ content, contentType }) {
  const type = contentType || "markdown";

  if (type === "formula") {
    return (
      <div className="katex-display overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {`$$${content}$$`}
        </ReactMarkdown>
      </div>
    );
  }

  if (type === "markdown") {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-[13px]">{children}</pre>
          ),
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono" {...props}>{children}</code>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-3 py-2">{children}</td>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-2 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const sources = msg.sources || [];
  const isSummary = msg.kind === "summary";
  const contentType = msg.content_type || (isUser ? "text" : "markdown");

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : isSummary
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-accent/80 text-accent-foreground border"
        )}
        aria-hidden
      >
        {isUser ? <GraduationCap className="h-5 w-5" /> : isSummary ? <FileText className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm sm:max-w-[75%]",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm border bg-card/60 backdrop-blur-sm"
        )}
      >
        {msg.title ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {msg.title}
          </p>
        ) : null}

        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ContentRenderer content={msg.content} contentType={contentType} />
        </div>

        {!isUser && sources.length > 0 ? (
          <div className="mt-4 border-t pt-3 border-border/50">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden /> Sources
            </p>
            <ul className="flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <li
                  key={s.id || i}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title={`Retrieved via ${s.retrieval_method || "hybrid"} · rank ${s.rank ?? i + 1}`}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">Source {s.rank ?? i + 1}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MaterialPicker({ open, onClose, onSelect }) {
  const { data: resources, error: queryError, isLoading } = useQuery({
    queryKey: ['chat-materials'],
    queryFn: async () => {
      const { data } = await api.get("/resources/?page_size=100");
      return data.results || data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const errorMsg = queryError ? "Could not load your materials." : null;
  const readyResources = (resources || []).filter((r) => r.processing_status === 'ready' && r.has_extractable_text !== false);

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-lg" role="dialog" aria-label="Pick a material">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
        <p className="text-sm font-medium">Summarize a material</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto chat-scroll p-1.5">
        {errorMsg ? (
          <li className="px-3 py-6 text-center text-sm text-destructive">{errorMsg}</li>
        ) : isLoading || resources === undefined ? (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </li>
        ) : readyResources.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No ready materials with extractable text.
          </li>
        ) : (
          readyResources.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                {r.mime_type?.startsWith('image/') ? (
                  <Image className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                )}
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
  const [pendingMaterial, setPendingMaterial] = useState(null);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const localIdCounter = useRef(0);

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
    setPendingMaterial(null);
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
    const localId = `local-${++localIdCounter.current}`;
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

  const handleMaterialSelect = (resource) => {
    setPickerOpen(false);
    setPendingMaterial(resource);
    setInput(`Summarize "${resource.title}" for me.`);
  };

  const confirmSummarize = async () => {
    const resource = pendingMaterial;
    if (!resource) return;
    setPendingMaterial(null);
    setInput("");
    setError("");
    setSummarizing(true);

    pushMessage({
      id: `ref-${resource.id}-${++localIdCounter.current}`,
      role: "user",
      title: "Material reference",
      content: `Please summarize "${resource.title}" for me.`,
    });

    const summaryId = `summary-${resource.id}-${++localIdCounter.current}`;
    pushMessage({
      id: summaryId,
      kind: "summary",
      title: `Summarizing "${resource.title}"…`,
      content: "Reading the material and drafting a summary.",
    });

    try {
      const { data: job } = await api.post(`/resources/${resource.id}/summarize/`);

      let result = null;
      let lastError = null;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 2000));
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

      const softError = result?.status === "failed" ? result.error : null;

      if (softError || lastError || !result?.summary) {
        setMessages((m) => m.filter((msg) => msg.id !== summaryId));
        toast.error(softError || lastError || "Summarization failed. The material may not have extractable text.");
      } else {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === summaryId
              ? { ...msg, title: `Summary of "${resource.title}"`, content: result.summary, content_type: "markdown" }
              : msg
          )
        );
      }
    } catch (err) {
      setMessages((m) => m.filter((msg) => msg.id !== summaryId));
      const msg = err.response?.data?.error?.detail || "Could not start summarization.";
      if (msg.includes('no extractable text')) {
        toast.error("This material has no extractable text and cannot be summarized.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <AppShell
      title="AI Assistant"
      description="Answers grounded in your authorized materials."
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
              <p className="px-2 py-4 text-xs text-muted-foreground">Your conversations will appear here.</p>
            ) : (
              <ul className="space-y-0.5">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openSession(s)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        s.id === sessionId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
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
              <button type="button" onClick={startNewChat} className="text-xs font-medium text-primary hover:underline md:hidden">
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
              <div className="mx-auto mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={loading}
                    className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left text-sm text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/30 hover:text-foreground hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    </span>
                    <span className="font-medium">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-6 overflow-y-auto p-6 chat-scroll bg-gradient-to-b from-transparent to-muted/20" role="log" aria-live="polite">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {loading ? (
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/80 text-accent-foreground border shadow-sm" aria-hidden>
                    <Bot className="h-5 w-5" />
                  </span>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border bg-card/60 backdrop-blur-sm px-5 py-4 shadow-sm">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          )}

          {error ? (
            <div className="px-6 pb-2">
              <Alert variant="destructive" className="shadow-sm">
                <CircleAlert className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {pendingMaterial && (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                Ready to summarize: <span className="font-medium">{pendingMaterial.title}</span>
              </span>
              <Button type="button" size="sm" onClick={confirmSummarize} disabled={summarizing} className="shrink-0">
                {summarizing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                Send
              </Button>
              <button type="button" onClick={() => { setPendingMaterial(null); setInput(''); }} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pendingMaterial) {
                confirmSummarize();
              } else {
                send();
              }
            }}
            className="relative border-t bg-background p-4 shadow-sm"
          >
            <MaterialPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={handleMaterialSelect}
            />
            <div className="flex items-end gap-3 mx-auto max-w-4xl">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                disabled={summarizing}
                aria-label="Reference a material"
                title="Reference a material to summarize"
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all focus-visible:outline-2 focus-visible:outline-ring",
                  pickerOpen
                    ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  summarizing && "cursor-not-allowed opacity-50"
                )}
              >
                <FileText className="h-5 w-5" aria-hidden />
              </button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (pendingMaterial) {
                      confirmSummarize();
                    } else {
                      send();
                    }
                  }
                }}
                placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={loading}
                aria-label="Message"
                className="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border-muted bg-muted/50 focus-visible:ring-1 text-[15px] p-3 shadow-inner"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || (!input.trim() && !pendingMaterial)}
                aria-label="Send message"
                className="h-12 w-12 shrink-0 rounded-xl shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <ArrowUp className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            {summarizing ? (
              <p className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-primary/80 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Analyzing material and drafting summary...
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
