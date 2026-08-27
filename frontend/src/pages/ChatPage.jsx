import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/api';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EmptyState from '@/components/shared/EmptyState';
import { cn, pickFileIcon } from '@/lib/utils';
import {
  ArrowUp,
  BookOpenCheck,
  Bot,
  Check,
  CircleAlert,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  FolderUp,
  GraduationCap,
  Image as ImageIcon,
  Library,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const SUGGESTIONS = [
  'Summarize the key ideas from my course materials.',
  'Explain a concept I am stuck on, step by step.',
  'What topics are likely to be examined?',
];

const ICON_MAP = {
  image: FileImage,
  video: FileVideo2,
  pdf: FileText,
  archive: FileArchive,
  sheet: FileSpreadsheet,
  doc: FileText,
  slides: FileText,
  code: FileCode2,
  audio: FileImage,
  file: Paperclip,
};

function AttachmentIcon({ name, mime, className }) {
  const key = pickFileIcon(mime || name);
  const Icon = ICON_MAP[key] || Paperclip;
  return <Icon className={className} aria-hidden />;
}

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

        {/* User-submitted attachments rendered above the text */}
        {isUser && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {msg.attachments.map((a, i) => (
              <li
                key={a.id || i}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-2 py-1 text-xs text-primary-foreground ring-1 ring-inset ring-white/20"
              >
                <AttachmentIcon name={a.title} mime={a.mime_type} className="h-3.5 w-3.5" />
                <span className="max-w-[200px] truncate">{a.title}</span>
              </li>
            ))}
          </ul>
        )}

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
              {sources.map((s, i) => {
                const title = s.resource_title || `Source ${s.rank ?? i + 1}`;
                const rank = s.rank ?? i + 1;
                const tooltip = `${title} · via ${s.retrieval_method || 'hybrid'} · rank ${rank}`;
                return (
                  <li key={s.id || i}>
                    {s.resource_id ? (
                      <Link
                        to={`/resources/${s.resource_id}`}
                        title={tooltip}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background/50 px-2.5 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="max-w-[220px] truncate">
                          {rank}. {title}
                        </span>
                        {s.version_number ? (
                          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">v{s.version_number}</span>
                        ) : null}
                      </Link>
                    ) : (
                      <span
                        title={tooltip}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background/50 px-2.5 py-1 text-xs"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="max-w-[220px] truncate">{rank}. {title}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MultiResourcePicker({ open, onClose, selected, onToggle }) {
  const { data: resources, error, isLoading } = useQuery({
    queryKey: ['chat-materials'],
    queryFn: async () => {
      const { data } = await api.get('/resources/?page_size=200');
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
  const ready = (resources || []).filter(
    (r) => r.processing_status === 'ready',
  );
  const selectedIds = new Set(selected.map((s) => s.id));

  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg" role="dialog" aria-label="Attach materials">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
        <div>
          <p className="text-sm font-medium">Attach materials</p>
          <p className="text-[11px] text-muted-foreground">{selected.length} selected · click to toggle</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="max-h-72 overflow-y-auto chat-scroll p-1.5">
        {error ? (
          <li className="px-3 py-6 text-center text-sm text-destructive">Could not load your materials.</li>
        ) : isLoading || resources === undefined ? (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </li>
        ) : ready.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No processed materials yet — upload one first.</li>
        ) : (
          ready.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onToggle(r)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  )}
                >
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30',
                  )}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <AttachmentIcon name={r.title} mime={r.mime_type} className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{r.visibility_scope} scope</span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function AttachmentChip({ attachment, onRemove, uploading }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <AttachmentIcon name={attachment.title} mime={attachment.mime_type} className="h-3.5 w-3.5 text-primary" />
      )}
      <span className="max-w-[180px] truncate">{attachment.title || 'Uploading…'}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.title}`}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
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
  const fileInputRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachedResources, setAttachedResources] = useState([]); // from library
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const localIdCounter = useRef(0);

  const sessionsQ = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: chatApi.listSessions,
    staleTime: 15_000,
  });
  const sessions = sessionsQ.data || [];

  useEffect(() => {
    const sid = searchParams.get('session');
    if (sid && !sessionId) {
      const existing = sessions.find((s) => s.id === sid);
      if (existing) openSession(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, searchParams]);

  const openSession = async (s) => {
    if (activeStream.current) { activeStream.current.abort(); activeStream.current = null; }
    setPickerOpen(false);
    setError('');
    setAttachedResources([]);
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
    setAttachedResources([]);
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
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false, content: m.content || '(stopped)' } : m)));
  };

  const toggleAttachedResource = (r) => {
    setAttachedResources((prev) => {
      if (prev.find((x) => x.id === r.id)) return prev.filter((x) => x.id !== r.id);
      return [...prev, r];
    });
  };

  const removeAttachedResource = (id) => {
    setAttachedResources((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingFiles(true);
    const sid = sessionId;
    try {
      for (const file of files) {
        // Add a temporary placeholder chip immediately for feedback.
        const placeholder = { id: `upload-${Date.now()}-${Math.random()}`, title: file.name, mime_type: file.type, pending: true };
        setAttachedResources((prev) => [...prev, placeholder]);
        try {
          const res = await chatApi.uploadAttachment(file, sid);
          // Replace the placeholder with the real resource returned by the API.
          const resource = res.resource;
          setAttachedResources((prev) => prev.map((p) => (p.id === placeholder.id ? resource : p)));
        } catch (err) {
          setAttachedResources((prev) => prev.filter((p) => p.id !== placeholder.id));
          toast.error(`Could not upload ${file.name}: ${err?.response?.data?.error?.detail || err.message || 'Upload failed'}`);
        }
      }
      qc.invalidateQueries({ queryKey: ['chat-materials'] });
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const send = async (textOverride) => {
    const content = (textOverride ?? input).trim();
    if ((!content && attachedResources.length === 0) || loading) return;
    setError('');
    setLoading(true);
    const localId = `local-${++localIdCounter.current}`;
    const assistantLocalId = `asst-${++localIdCounter.current}`;
    // Snapshot attachments at send time and clear the picker/chips.
    const attachments = attachedResources.map((r) => ({ id: r.id, title: r.title, mime_type: r.mime_type }));
    const resourceIds = attachedResources.map((r) => r.id).filter(Boolean);
    const userContent = content || `Tell me about ${attachments.map((a) => `"${a.title}"`).join(', ')}.`;
    pushMessage({ id: localId, role: 'user', content: userContent, attachments });
    setInput('');
    setAttachedResources([]);
    setPickerOpen(false);

    try {
      const sid = await ensureSession();
      pushMessage({ id: assistantLocalId, role: 'assistant', content: '', streaming: true, sources: [] });
      let fullContent = '';

      const ctrl = chatApi.stream(sid, userContent, {
        resourceIds,
        onMeta: (meta) => {
          if (meta?.user_message) {
            setMessages((prev) => prev.map((m) => (m.id === localId ? meta.user_message : m)));
          }
          if (sessionTitle === '' || sessionTitle === 'New chat') {
            setSessionTitle(userContent.slice(0, 60));
          }
        },
        onToken: (tok) => {
          fullContent += tok;
          setMessages((prev) => prev.map((m) => (m.id === assistantLocalId ? { ...m, content: fullContent } : m)));
        },
        onDone: (assistantMsg) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantLocalId ? { ...assistantMsg, streaming: false } : m)));
          setSessionTitle((t) => t || userContent.slice(0, 60));
          qc.invalidateQueries({ queryKey: ['chat-sessions'] });
          activeStream.current = null;
          setLoading(false);
        },
        onError: (err) => {
          setMessages((prev) => prev.filter((x) => x.id !== localId && x.id !== assistantLocalId));
          setInput(userContent);
          setError(err.message || 'Failed to send');
          activeStream.current = null;
          setLoading(false);
        },
      });
      activeStream.current = ctrl;
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== localId && x.id !== assistantLocalId));
      setInput(userContent);
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

  const sessionsWithDisplay = useMemo(() => sessions, [sessions]);

  return (
    <AppShell fullBleed>
      <div className="flex h-full w-full">
        {/* History sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
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
                        {s.message_count || 0} msgs
                      </span>
                    </button>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteSession(s); }}
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

        {/* Conversation column */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b bg-background/60 px-4 py-3 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted md:hidden"
              >
                <Sparkles className="h-3.5 w-3.5" /> New
              </button>
              {sessionTitle ? (
                editingTitle ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') renameSession(); if (e.key === 'Escape') setEditingTitle(false); }}
                      autoFocus
                      className="h-8 flex-1 rounded-lg border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                      maxLength={255}
                    />
                    <Button size="sm" variant="ghost" onClick={renameSession}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-sm font-semibold">{sessionTitle || 'New chat'}</h2>
                    <button
                      type="button"
                      onClick={() => { setTitleDraft(sessionTitle); setEditingTitle(true); }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Rename"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )
              ) : (
                <h2 className="text-sm font-semibold">New chat</h2>
              )}
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Grounded in your authorized materials · Streaming enabled
            </p>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto chat-scroll">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
                <EmptyState
                  icon={Sparkles}
                  title="Ask anything about your courses"
                  description="Attach one or more materials from your library, or upload files directly from your device. Responses stream in real time with clickable citations."
                />
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setInput(s); setTimeout(() => send(s), 0); }}
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
              <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6" role="log" aria-live="polite">
                {messages.map((msg) => (<MessageBubble key={msg.id} msg={msg} />))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {error ? (
            <div className="px-4 pb-2 sm:px-6">
              <Alert variant="destructive" className="shadow-sm">
                <CircleAlert className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (loading) { stopStreaming(); return; }
              send();
            }}
            className="relative border-t bg-background/70 px-4 py-4 backdrop-blur sm:px-6"
          >
            <MultiResourcePicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              selected={attachedResources}
              onToggle={toggleAttachedResource}
            />

            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {/* Attachment tray */}
              {attachedResources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-2">
                  {attachedResources.map((r) => (
                    <AttachmentChip
                      key={r.id}
                      attachment={r}
                      uploading={!!r.pending}
                      onRemove={loading ? undefined : () => removeAttachedResource(r.id)}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/20">
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  disabled={loading}
                  aria-label="Attach from library"
                  title="Attach from library"
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    pickerOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Library className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadingFiles}
                  aria-label="Upload files from device"
                  title="Upload files"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  <FolderUp className="h-5 w-5" aria-hidden />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) send(); }
                  }}
                  placeholder={attachedResources.length
                    ? `Ask about ${attachedResources.length} attached file${attachedResources.length === 1 ? '' : 's'}… (Enter to send, Shift+Enter for newline)`
                    : 'Ask anything about your courses… (Enter to send, Shift+Enter for newline)'}
                  rows={1}
                  disabled={loading}
                  aria-label="Message"
                  className="max-h-48 min-h-[40px] flex-1 resize-none border-0 bg-transparent p-2 text-[15px] shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={loading ? false : (!input.trim() && attachedResources.length === 0) || uploadingFiles}
                  aria-label={loading ? 'Stop generating' : 'Send message'}
                  className={cn('h-10 w-10 shrink-0 rounded-xl shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]', loading && 'bg-destructive hover:bg-destructive/90')}
                >
                  {loading ? <Square className="h-5 w-5 fill-current" aria-hidden /> : <ArrowUp className="h-5 w-5" aria-hidden />}
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                Answers are grounded in your authorized materials · {loading ? 'generating — click stop to interrupt' : 'attach files from your library or device'}
              </p>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
