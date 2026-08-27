import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/api';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import {
  ArrowUp, BookOpenCheck, Bot, CircleAlert, FileText,
  GraduationCap, Image, Link2, Loader2, Pencil, Send,
  Sparkles, Square, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const SUGGESTIONS = [
  'Summarize the key ideas from my course materials.',
  'Explain a concept I\'m stuck on, step by step.',
  'What topics are likely to be examined?',
];

function ContentRenderer({ content, contentType }) {
  const type = contentType || 'markdown';
  if (type === 'formula') {
    return (
      <div className="katex-display overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {`$$${content}$$`}
        </ReactMarkdown>
      </div>
    );
  }
  if (type === 'markdown') {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-[13px]">{children}</pre>
          ),
          code: ({ inline, className, children, ...props }) => {
            if (inline) return <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono" {...props}>{children}</code>;
            return <code className={className} {...props}>{children}</code>;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>
          ),
          th: ({ children }) => <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
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
  const isUser = msg.role === 'user';
  const sources = msg.sources || [];
  const isStreaming = msg.streaming;
  const isSummary = msg.kind === 'summary';
  const contentType = msg.content_type || (isUser ? 'text' : 'markdown');

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSummary
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-accent/80 text-accent-foreground border',
        )}
        aria-hidden
      >
        {isUser ? <GraduationCap className="h-5 w-5" /> : isSummary ? <FileText className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm sm:max-w-[75%]',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm border bg-card/60 backdrop-blur-sm',
        )}
      >
        {msg.title ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{msg.title}</p>
        ) : null}

        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ContentRenderer content={msg.content} contentType={contentType} />
          {isStreaming && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary/60 align-middle" />}
        </div>

        {!isUser && sources.length > 0 ? (
          <div className="mt-4 border-t pt-3 border-border/50">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden /> Sources
            </p>
            <ul className="flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <li key={s.id || i}>
                  <Link
                    to={s.resource_id ? `/resources/${s.resource_id}` : '#'}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background/50 px-2.5 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    title={`${s.resource_title || 'Source'} · via ${s.retrieval_method || 'hybrid'} · rank ${s.rank ?? i + 1}`}
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    <span className="max-w-[200px] truncate">
                      {s.resource_title ? `${i + 1}. ${s.resource_title}` : `Source ${s.rank ?? i + 1}`}
                    </span>
                  </Link>
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
      const { data } = await api.get('/resources/?page_size=100');
      return data.results || data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const errorMsg = queryError ? 'Could not load your materials.' : null;
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
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No ready materials with extractable text.</li>
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
                  <span className="block truncate text-xs capitalize text-muted-foreground">{r.visibility_scope} scope</span>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const activeStream = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMaterial, setPendingMaterial] = useState(null);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const localIdCounter = useRef(0);

  // Sessions list
  const sessionsQ = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: chatApi.listSessions,
    staleTime: 15_000,
  });
  const sessions = sessionsQ.data || [];

  // Open session from URL param on first load
  useEffect(() => {
    const sid = searchParams.get('session');
    if (sid && !sessionId) {
      const existing = sessions.find((s) => s.id === sid);
      if (existing) openSession(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, searchParams]);

  const openSession = async (s) => {
    // Cancel any active stream
    if (activeStream.current) { activeStream.current.abort(); activeStream.current = null; }
    setPickerOpen(false);
    setError('');
    setSessionId(s.id);
    setSessionTitle(s.title || 'Conversation');
    setTitleDraft(s.title || '');
    try {
      const msgs = await chatApi.getMessages(s.id);
      setMessages(msgs);
    } catch {
      setError('Could not load that conversation.');
    }
    setSearchParams({ session: s.id }, { replace: true });
  };

  const startNewChat = () => {
    if (activeStream.current) { activeStream.current.abort(); activeStream.current = null; }
    setSessionId(null);
    setSessionTitle('');
    setTitleDraft('');
    setMessages([]);
    setPickerOpen(false);
    setPendingMaterial(null);
    setError('');
    setLoading(false);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const { data } = await chatApi.createSession({ title: 'New chat' });
    setSessionId(data.id);
    setSessionTitle(data.title || 'New chat');
    setTitleDraft(data.title || 'New chat');
    qc.invalidateQueries({ queryKey: ['chat-sessions'] });
    setSearchParams({ session: data.id }, { replace: true });
    return data.id;
  };

  const pushMessage = (msg) => setMessages((m) => [...m, msg]);

  const stopStreaming = () => {
    if (activeStream.current) {
      activeStream.current.abort();
      activeStream.current = null;
    }
    setLoading(false);
    // Finalize streaming placeholder
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false, content: m.content || '(stopped)' } : m)));
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError('');
    setLoading(true);
    const localId = `local-${++localIdCounter.current}`;
    const assistantLocalId = `asst-${++localIdCounter.current}`;
    pushMessage({ id: localId, role: 'user', content });
    setInput('');
    try {
      const sid = await ensureSession();
      // Placeholder assistant message
      pushMessage({ id: assistantLocalId, role: 'assistant', content: '', streaming: true, sources: [] });

      let userMsgConfirmed = false;
      activeStream.current = chatApi.stream(sid, content, {
        onMeta: (meta) => {
          if (meta?.user_message && !userMsgConfirmed) {
            // Replace optimistic user message with server version
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? meta.user_message : m)),
            );
            userMsgConfirmed = true;
          }
          if (sessionTitle === '' || sessionTitle === 'New chat') {
            setSessionTitle(content.slice(0, 60));
          }
        },
        onToken: (tok) => {
          setMessages((prev) => prev.map((m) => (
            m.id === assistantLocalId ? { ...m, content: m.content + tok } : m
          )));
        },
        onDone: (assistantMsg) => {
          setMessages((prev) => prev.map((m) => (
            m.id === assistantLocalId ? { ...assistantMsg, streaming: false } : m
          )));
          setSessionTitle((t) => t || content.slice(0, 60));
          qc.invalidateQueries({ queryKey: ['chat-sessions'] });
          activeStream.current = null;
          setLoading(false);
        },
        onError: (err) => {
          setMessages((prev) => prev.filter((x) => x.id !== localId && x.id !== assistantLocalId));
          setInput(content);
          setError(err.message || 'Failed to send');
          activeStream.current = null;
          setLoading(false);
        },
      });
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== localId && x.id !== assistantLocalId));
      setInput(content);
      setError(err.response?.data?.error?.detail || 'Failed to send');
      setLoading(false);
    }
  };

  const renameSession = async () => {
    if (!sessionId || !titleDraft.trim()) return;
    setEditingTitle(false);
    setSessionTitle(titleDraft.trim());
    try {
      await chatApi.renameSession(sessionId, titleDraft.trim());
      qc.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Conversation renamed');
    } catch {
      toast.error('Could not rename conversation');
    }
  };

  const deleteSession = async (s) => {
    if (!confirm(`Delete "${s.title || 'Untitled chat'}"? This cannot be undone.`)) return;
    try {
      await chatApi.deleteSession(s.id);
      if (s.id === sessionId) startNewChat();
      qc.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Conversation deleted');
    } catch {
      toast.error('Could not delete conversation');
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
    setInput('');
    setError('');
    // For summary we keep the simple flow using the existing job endpoint
    pushMessage({
      id: `ref-${resource.id}-${++localIdCounter.current}`,
      role: 'user',
      title: 'Material reference',
      content: `Please summarize "${resource.title}" for me.`,
    });
    const summaryId = `summary-${resource.id}-${++localIdCounter.current}`;
    pushMessage({
      id: summaryId, kind: 'summary',
      title: `Summarizing "${resource.title}"…`,
      content: 'Reading the material and drafting a summary.',
    });
    try {
      const { data: job } = await api.post(`/resources/${resource.id}/summarize/`);
      let result = null;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await api.get(`/jobs/${job.job_id}/`);
        const st = poll.data.status;
        if (st === 'success') { result = poll.data.result; break; }
        if (st === 'failure') { throw new Error(poll.data.error || 'Summarization failed.'); }
      }
      if (result?.status === 'failed') throw new Error(result.error);
      if (!result?.summary) throw new Error('No summary returned.');
      setMessages((m) => m.map((msg) => (
        msg.id === summaryId
          ? { ...msg, title: `Summary of "${resource.title}"`, content: result.summary, content_type: 'markdown' }
          : msg
      )));
    } catch (err) {
      setMessages((m) => m.filter((msg) => msg.id !== summaryId));
      toast.error(err.message || 'Summarization failed.');
    }
  };

  const sessionsWithDisplay = useMemo(() => sessions, [sessions]);

  return (
    <AppShell title="AI Assistant" description="Answers grounded in your authorized materials — streaming, with clickable citations.">
      <div className="flex h-[calc(100vh-14rem)] min-h-[440px] gap-4">
        {/* History sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm md:flex">
          <div className="border-b p-2.5">
            <button
              type="button" onClick={startNewChat}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> New chat
            </button>
          </div>
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">History</p>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2 chat-scroll">
            {sessionsQ.isLoading ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
            ) : sessionsWithDisplay.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">Your conversations will appear here.</p>
            ) : (
              <ul className="space-y-0.5">
                {sessionsWithDisplay.map((s) => (
                  <li key={s.id} className="group relative">
                    <button
                      type="button" onClick={() => openSession(s)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 pr-16 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                        s.id === sessionId
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span className="block truncate">{s.title || 'Untitled chat'}</span>
                      <span className="block truncate text-[11px] opacity-70">
                        {s.message_count || 0} msgs · {new Date(s.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button" onClick={(e) => { e.stopPropagation(); /* simple delete without edit button clutter */ deleteSession(s); }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete conversation"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Conversation */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          {sessionTitle ? (
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
              {editingTitle ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') renameSession(); if (e.key === 'Escape') setEditingTitle(false); }}
                    autoFocus className="h-8 text-sm" maxLength={255}
                  />
                  <Button size="sm" variant="ghost" onClick={renameSession}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-medium">{sessionTitle}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button" onClick={() => { setTitleDraft(sessionTitle); setEditingTitle(true); }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Rename" title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={startNewChat} className="text-xs font-medium text-primary hover:underline md:hidden">
                      New
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 chat-scroll">
              <EmptyState
                icon={Sparkles}
                title="Ask anything about your courses"
                description="Responses stream in real time with citations to your authorized materials."
              />
              <div className="mx-auto mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s} type="button" onClick={() => send(s)} disabled={loading}
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
              {messages.map((msg) => (<MessageBubble key={msg.id} msg={msg} />))}
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
              <Button type="button" size="sm" onClick={confirmSummarize} className="shrink-0"><Send className="mr-1 h-3.5 w-3.5" />Send</Button>
              <button type="button" onClick={() => { setPendingMaterial(null); setInput(''); }} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (loading) { stopStreaming(); return; }
              if (pendingMaterial) confirmSummarize(); else send();
            }}
            className="relative border-t bg-background p-4 shadow-sm"
          >
            <MaterialPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleMaterialSelect} />
            <div className="mx-auto flex max-w-4xl items-end gap-3">
              <button
                type="button" onClick={() => setPickerOpen((o) => !o)} disabled={loading}
                aria-label="Reference a material" title="Reference a material to summarize"
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all focus-visible:outline-2 focus-visible:outline-ring',
                  pickerOpen ? 'border-primary/50 bg-primary/10 text-primary shadow-sm' : 'border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <FileText className="h-5 w-5" aria-hidden />
              </button>
              <Textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) { pendingMaterial ? confirmSummarize() : send(); } }
                }}
                placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
                rows={1} disabled={loading && !activeStream.current}
                aria-label="Message"
                className="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border-muted bg-muted/50 focus-visible:ring-1 text-[15px] p-3 shadow-inner"
              />
              <Button
                type="submit" size="icon"
                disabled={!loading && !input.trim() && !pendingMaterial}
                aria-label={loading ? 'Stop generating' : 'Send message'}
                className={cn('h-12 w-12 shrink-0 rounded-xl shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]', loading && 'bg-destructive hover:bg-destructive/90')}
              >
                {loading ? <Square className="h-5 w-5 fill-current" aria-hidden /> : <ArrowUp className="h-5 w-5" aria-hidden />}
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-4xl text-center text-[11px] text-muted-foreground">
              Answers are grounded in your authorized materials · {loading ? 'generating — click stop to interrupt' : 'streaming enabled'}
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
