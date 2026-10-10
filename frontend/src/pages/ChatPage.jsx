import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import { toast } from 'sonner';
import {
  ArrowUp,
  ChevronLeft,
  CircleAlert,
  FileText,
  FileUp,
  GraduationCap,
  History as HistoryIcon,
  Library,
  Link2,
  MessageSquarePlus,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuth } from '@/hooks/useAuth';
import { useAgent } from '@/hooks/useAgent';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyChatIllustration } from '@/components/shared/illustrations';
import {
  AttachmentChip,
  HistoryItem,
  MessageBubble,
  SourceCard,
} from '@/components/chat/messageParts';
import SourceDetailDialog from '@/components/chat/SourceDetailDialog';
import {
  confirmedResourceIds,
  loadSnapshot,
  saveSnapshot,
} from '@/components/chat/chatShared';
import MultiResourcePicker from '@/components/chat/MultiResourcePicker';

// A pending upload's id is a local `upload-…` string, not the UUID the API
// expects, so it must never leave the composer.
// eslint-disable-next-line react-refresh/only-export-components
export { confirmedResourceIds } from '@/components/chat/chatShared';

const SUGGESTIONS = [
  {
    icon: Sparkles,
    title: 'Summarize my materials',
    prompt:
      'Summarize the key ideas from my course materials into concise bullet points.',
  },
  {
    icon: FileText,
    title: 'Explain a concept',
    prompt: 'Explain a concept I am stuck on, step by step with examples.',
  },
  {
    icon: GraduationCap,
    title: 'Exam prep',
    prompt:
      'Based on my course materials, which topics are most likely to appear on the exam? Generate 5 practice questions.',
  },
  {
    icon: Library,
    title: 'Compare sources',
    prompt:
      'Compare and contrast the main arguments across the materials I have uploaded.',
  },
];

export default function ChatPage() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const { user } = useAuth();
  const { identity } = useAgent();

  const [sessionId, setSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const activeStream = useRef(null);
  const fileInputRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachedResources, setAttachedResources] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const localIdCounter = useRef(0);
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Feed Virtuoso the same "stuck at bottom" flag the old manual scroll
  // handler tracked (also reset back to `true` when opening a session,
  // see openSession).
  const stuckToBottomRef = useRef(true);
  const handleAtBottomChange = useCallback((atBottom) => {
    stuckToBottomRef.current = atBottom;
  }, []);

  // Sources rail state
  const [sourcesRailOpen, setSourcesRailOpen] = useState(!isMobile);
  const [activeSourceRank, setActiveSourceRank] = useState(null);
  const [openedResourceId, setOpenedResourceId] = useState(null);
  const [sourceDetail, setSourceDetail] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(!isMobile);
  const [historyQuery, setHistoryQuery] = useState('');

  const sessionsQ = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: chatApi.listSessions,
    staleTime: 15_000,
  });
  const sessions = useMemo(() => sessionsQ.data || [], [sessionsQ.data]);

  // The assistant message we should show sources for:
  // the last assistant message that has sources (or the streaming one).
  const activeMessageForSources = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const currentSources = useMemo(() => {
    const srcs = activeMessageForSources?.sources || [];
    return [...srcs].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [activeMessageForSources]);

  // Auto-open sources rail when sources arrive
  useEffect(() => {
    if (currentSources.length > 0 && !isMobile) setSourcesRailOpen(true);
  }, [currentSources.length, isMobile]);

  // Deep-link session via ?session=. Opens the matching conversation once the
  // sidebar list is available so we get the real title; if the list settled
  // without the session (paged out, deleted, or list error) we still open the
  // id directly — getMessages needs only the id, and failures surface in the
  // chat pane — so a deep link never silently no-ops.
  useEffect(() => {
    if (sessionId) return;
    const sid = searchParams.get('session');
    if (!sid) return;
    const existing = sessions.find((s) => s.id === sid);
    if (existing) {
      openSession(existing);
      return;
    }
    if (sessionsQ.isLoading) return;
    openSession({ id: sid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, searchParams, sessions, sessionsQ.isLoading]);

  // Restore the in-progress conversation from sessionStorage when the page is
  // (re)mounted — e.g. after switching sidebar tabs in the same browser tab.
  // This is what keeps the chat alive across tab switches instead of resetting.
  useEffect(() => {
    const snap = loadSnapshot();
    if (!snap || !snap.sessionId) return;
    // Only restore if there is no explicit ?session= deep link (which wins).
    const sid = searchParams.get('session');
    if (sid) return;
    setSessionId(snap.sessionId);
    setSessionTitle(snap.sessionTitle || 'Conversation');
    setTitleDraft(snap.sessionTitle || '');
    if (Array.isArray(snap.messages)) setMessages(snap.messages);
    if (typeof snap.input === 'string') setInput(snap.input);
    if (snap.sessionId)
      setSearchParams({ session: snap.sessionId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the active conversation so it survives page unmounts between tabs.
  // Debounced so typing can't serialize the whole message array on every
  // keystroke; the snapshot only writes once the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveSnapshot({ sessionId, sessionTitle, messages, input });
    }, 400);
    return () => clearTimeout(timer);
  }, [sessionId, sessionTitle, messages, input]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const openSession = useCallback(
    async (s) => {
      if (activeStream.current) {
        activeStream.current.abort();
        activeStream.current = null;
      }
      setPickerOpen(false);
      setError('');
      setAttachedResources([]);
      setActiveSourceRank(null);
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
      if (isMobile) setHistoryOpen(false);
    },
    [isMobile, setSearchParams],
  );

  const startNewChat = useCallback(() => {
    if (activeStream.current) {
      activeStream.current.abort();
      activeStream.current = null;
    }
    setSessionId(null);
    setSessionTitle('');
    setTitleDraft('');
    setMessages([]);
    setPickerOpen(false);
    setAttachedResources([]);
    setError('');
    setLoading(false);
    setActiveSourceRank(null);
    setSearchParams({}, { replace: true });
    if (isMobile) setHistoryOpen(false);
  }, [isMobile, setSearchParams]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const session = await chatApi.createSession({ title: 'New chat' });
    setSessionId(session.id);
    setSessionTitle(session.title || 'New chat');
    setTitleDraft(session.title || 'New chat');
    qc.invalidateQueries({ queryKey: ['chat-sessions'] });
    setSearchParams({ session: session.id }, { replace: true });
    return session.id;
  };

  const pushMessage = (msg) => setMessages((m) => [...m, msg]);

  const stopStreaming = () => {
    if (activeStream.current) {
      activeStream.current.abort();
      activeStream.current = null;
    }
    setLoading(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.streaming
          ? { ...m, streaming: false, content: m.content || '(stopped)' }
          : m,
      ),
    );
  };

  const toggleAttachedResource = (r) => {
    setAttachedResources((prev) => {
      if (prev.find((x) => x.id === r.id))
        return prev.filter((x) => x.id !== r.id);
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
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} exceeds the 25 MB limit.`);
          continue;
        }
        const placeholder = {
          id: `upload-${Date.now()}-${Math.random()}`,
          title: file.name,
          mime_type: file.type,
          size: file.size,
          pending: true,
          source: 'upload',
        };
        setAttachedResources((prev) => [...prev, placeholder]);
        try {
          const res = await chatApi.uploadAttachment(file, sid);
          const resource = { ...res.resource, source: 'upload' };
          setAttachedResources((prev) =>
            prev.map((p) => (p.id === placeholder.id ? resource : p)),
          );
        } catch (err) {
          setAttachedResources((prev) =>
            prev.filter((p) => p.id !== placeholder.id),
          );
          toast.error(
            `Could not upload ${file.name}: ${err?.response?.data?.error?.detail || err.message || 'Upload failed'}`,
          );
        }
      }
      qc.invalidateQueries({ queryKey: ['chat-materials'] });
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const regenerate = async () => {
    // Find the last user message and resend its text without attachments.
    let lastUser = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = messages[i];
        break;
      }
    }
    if (!lastUser || loading) return;
    setInput(lastUser.content);
    // Remove the last assistant message + resend
    setMessages((prev) => {
      const out = [...prev];
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].role === 'assistant') {
          out.splice(i, 1);
          break;
        }
      }
      return out;
    });
    setTimeout(() => send(lastUser.content), 0);
  };

  const send = async (textOverride) => {
    const content = (textOverride ?? input).trim();
    if (
      (!content && attachedResources.length === 0) ||
      loading ||
      uploadingFiles
    )
      return;
    stuckToBottomRef.current = true;
    setError('');
    setLoading(true);
    const localId = `local-${++localIdCounter.current}`;
    const assistantLocalId = `asst-${++localIdCounter.current}`;
    const attachments = attachedResources.map((r) => ({
      id: r.id,
      title: r.title,
      mime_type: r.mime_type,
      size: r.size,
    }));
    const resourceIds = confirmedResourceIds(attachedResources);
    const userContent =
      content ||
      `Tell me about ${attachments.map((a) => `"${a.title}"`).join(', ')}.`;
    pushMessage({
      id: localId,
      role: 'user',
      content: userContent,
      attachments,
      created_at: new Date().toISOString(),
    });
    setInput('');
    setAttachedResources([]);
    setPickerOpen(false);
    setActiveSourceRank(null);

    try {
      const sid = await ensureSession();
      pushMessage({
        id: assistantLocalId,
        role: 'assistant',
        content: '',
        streaming: true,
        sources: [],
        created_at: new Date().toISOString(),
      });
      let fullContent = '';
      let currentSources = [];

      const ctrl = chatApi.stream(sid, userContent, {
        resourceIds,
        onMeta: (meta) => {
          if (meta?.user_message) {
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? meta.user_message : m)),
            );
          }
          if (meta?.confidence || meta?.retrieval_ms != null) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantLocalId
                  ? {
                      ...m,
                      confidence: meta.confidence,
                      retrieval_ms: meta.retrieval_ms,
                    }
                  : m,
              ),
            );
          }
          if (!sessionTitle || sessionTitle === 'New chat') {
            setSessionTitle(userContent.slice(0, 60));
          }
        },
        onToken: (tok) => {
          fullContent += tok;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantLocalId ? { ...m, content: fullContent } : m,
            ),
          );
        },
        onDone: (assistantMsg) => {
          if (assistantMsg?.sources) currentSources = assistantMsg.sources;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantLocalId
                ? { ...assistantMsg, streaming: false }
                : m,
            ),
          );
          setSessionTitle((t) => t || userContent.slice(0, 60));
          qc.invalidateQueries({ queryKey: ['chat-sessions'] });
          activeStream.current = null;
          setLoading(false);
          if (currentSources.length > 0 && !isMobile) setSourcesRailOpen(true);
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.filter((x) => x.id !== localId && x.id !== assistantLocalId),
          );
          setInput(userContent);
          setError(err.message || 'Failed to send');
          activeStream.current = null;
          setLoading(false);
        },
      });
      activeStream.current = ctrl;
    } catch (err) {
      setMessages((m) =>
        m.filter((x) => x.id !== localId && x.id !== assistantLocalId),
      );
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
    try {
      await chatApi.deleteSession(s.id);
      if (s.id === sessionId) startNewChat();
      qc.invalidateQueries({ queryKey: ['chat-sessions'] });
      toast.success('Conversation deleted');
    } catch {
      toast.error('Could not delete conversation');
    }
  };

  const openSourceResource = (resourceId) => {
    setOpenedResourceId(resourceId);
  };

  const filteredHistory = useMemo(() => {
    if (!historyQuery.trim()) return sessions;
    const q = historyQuery.toLowerCase();
    return sessions.filter((s) => (s.title || '').toLowerCase().includes(q));
  }, [sessions, historyQuery]);

  return (
    <TooltipProvider delayDuration={150}>
      <AppShell fullBleed>
        <div className="flex h-full w-full">
          {/* History rail (mobile: drawer) */}
          {historyOpen && (
            <>
              {isMobile && (
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                  onClick={() => setHistoryOpen(false)}
                  aria-hidden
                />
              )}
              <aside
                role={isMobile ? 'dialog' : undefined}
                aria-modal={isMobile ? true : undefined}
                aria-label="Chat history"
                onKeyDown={
                  isMobile
                    ? (e) => {
                        if (e.key === 'Escape') setHistoryOpen(false);
                      }
                    : undefined
                }
                className={cn(
                  'flex shrink-0 flex-col border-r bg-sidebar',
                  isMobile
                    ? 'fixed inset-y-0 left-0 z-50 w-72 animate-slide-right'
                    : 'w-64',
                )}
              >
                <div className="border-b p-3">
                  <Button
                    size="sm"
                    onClick={startNewChat}
                    className="h-8 w-full gap-1.5 bg-[var(--accent)] text-xs text-[var(--on-accent)] hover:bg-[var(--accent-strong)]"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                    New chat
                  </Button>
                </div>
                <div className="border-b px-3 py-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="Search history…"
                      aria-label="Search chat history"
                      className="h-7 w-full rounded-md border bg-background pl-7 pr-2 text-[11px] focus-visible:outline-2 focus-visible:outline-ring"
                    />
                  </div>
                </div>
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  Recent
                </p>
                <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                  {sessionsQ.isLoading ? (
                    <p className="px-2 py-3 text-[11px] text-sidebar-muted">
                      Loading…
                    </p>
                  ) : filteredHistory.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-sidebar-muted">
                      {historyQuery
                        ? 'No matches.'
                        : 'Your conversations will appear here.'}
                    </p>
                  ) : (
                    filteredHistory.map((s) => (
                      <HistoryItem
                        key={s.id}
                        s={s}
                        active={s.id === sessionId}
                        onClick={() => openSession(s)}
                        onDelete={setSessionToDelete}
                      />
                    ))
                  )}
                </div>
              </aside>
            </>
          )}

          {/* Conversation column */}
          <section className="flex min-w-0 flex-1 flex-col">
            {/* Header */}
            <header className="glass flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground lg:hidden"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('academiai:open-mobile-menu'),
                  )
                }
                aria-label="Open menu"
                title="Open menu"
              >
                <Menu className="h-4 w-4" aria-hidden />
              </Button>
              <div className="flex min-w-0 items-center gap-1.5">
                {!historyOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setHistoryOpen(true)}
                    aria-label="Show history"
                  >
                    <HistoryIcon className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                {historyOpen && isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setHistoryOpen(false)}
                    aria-label="Hide history"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                {sessionTitle ? (
                  editingTitle ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameSession();
                          if (e.key === 'Escape') setEditingTitle(false);
                        }}
                        autoFocus
                        className="h-7 flex-1 rounded-md border bg-background px-2 text-[13px] focus-visible:outline-2 focus-visible:outline-ring"
                        maxLength={255}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={renameSession}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingTitle(false)}
                        aria-label="Cancel rename"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="truncate text-sm font-semibold">
                        {sessionTitle}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setTitleDraft(sessionTitle);
                          setEditingTitle(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )
                ) : (
                  <h2 className="text-sm font-semibold">AcademiAI Chat</h2>
                )}
              </div>
              <div className="flex items-center gap-1">
                {currentSources.length > 0 && (
                  <Button
                    variant={sourcesRailOpen ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-[11px]"
                    onClick={() => setSourcesRailOpen((v) => !v)}
                  >
                    {sourcesRailOpen ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    )}
                    Sources
                    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                      {currentSources.length}
                    </span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] text-muted-foreground md:hidden"
                  onClick={startNewChat}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" /> New
                </Button>
              </div>
            </header>

            {/* Messages */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1">
                {/* Streaming announces one concise status instead of every token:
  the full log stays out of the live region to avoid SR spam. */}
                <p role="status" className="sr-only">
                  {loading ? 'Assistant is responding…' : ''}
                </p>
                {messages.length === 0 ? (
                  <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center sm:p-8">
                    {/* Empty hero */}
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-muted-foreground">
                        <EmptyChatIllustration className="h-20 w-20" />
                      </span>
                      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        What can I help you{' '}
                        <span className="text-[var(--accent-strong)]">study</span> today?
                      </h1>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Ask questions about your authorized materials. Responses
                        stream in real time with numbered citations that open
                        the source document directly.
                      </p>
                    </div>
                    <div className="grid w-full gap-2.5 sm:grid-cols-2">
                      {SUGGESTIONS.map((s) => {
                        const Icon = s.icon;
                        return (
                          <button
                            key={s.title}
                            type="button"
                            onClick={() => {
                              setInput(s.prompt);
                              setTimeout(() => send(s.prompt), 0);
                            }}
                            disabled={loading}
                            className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-[var(--border-strong)]"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold">
                                {s.title}
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                                {s.prompt}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Virtuoso
                    data={messages}
                    alignToBottom
                    initialTopMostItemIndex={messages.length - 1}
                    style={{ height: '100%' }}
                    className="min-w-0"
                    followOutput={(isAtBottom) =>
                      isAtBottom ? (reducedMotion ? 'auto' : 'smooth') : false
                    }
                    atBottomStateChange={handleAtBottomChange}
                    computeItemKey={(_, msg) => msg.id}
                    components={{
                      List: forwardRef(({ style, children, ...props }, ref) => (
                        <div
                          ref={ref}
                          {...props}
                          style={style}
                          className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6"
                        >
                          {children}
                        </div>
                      )),
                    }}
                    itemContent={(idx, msg) => (
                      <MessageBubble
                        msg={msg}
                        user={user}
                        identity={identity}
                        isLastAssistant={
                          msg.role === 'assistant' &&
                          idx === messages.length - 1 &&
                          !loading
                        }
                        onSourceClick={(rank) => {
                          setActiveSourceRank(rank);
                          setSourcesRailOpen(true);
                        }}
                        onOpenSourceResource={openSourceResource}
                        onRegenerate={regenerate}
                      />
                    )}
                  />
                )}
              </div>

              {/* Sources rail */}
              {sourcesRailOpen && currentSources.length > 0 && (
                <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l bg-card/40 p-3.5 md:flex">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sources
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSourcesRailOpen(false)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Close sources panel"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                    {currentSources.length} document
                    {currentSources.length === 1 ? '' : 's'} used to ground this
                    answer. Click a numbered citation in the response to
                    highlight its source.
                  </p>
                  <div className="space-y-1.5">
                    {currentSources.map((s) => (
                      <SourceCard
                        key={s.chunk_id || s.id || s.rank}
                        source={s}
                        active={activeSourceRank === s.rank}
                        onClick={() =>
                          setActiveSourceRank((r) =>
                            r === s.rank ? null : s.rank,
                          )
                        }
                        onOpenResource={openSourceResource}
                        onDetailClick={(src) => setSourceDetail(src)}
                      />
                    ))}
                  </div>
                </aside>
              )}
            </div>

            {error ? (
              <div className="px-4 pb-2 sm:px-6">
                <Alert variant="destructive" className="shadow-sm">
                  <CircleAlert className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (loading) {
                  stopStreaming();
                  return;
                }
                send();
              }}
              className="relative border-t bg-background/80 px-3 py-3 backdrop-blur sm:px-6"
            >
              <MultiResourcePicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                selected={attachedResources}
                onToggle={toggleAttachedResource}
              />
              <div className="mx-auto max-w-3xl">
                {attachedResources.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/30 p-2">
                    {attachedResources.map((r) => (
                      <AttachmentChip
                        key={r.id}
                        attachment={r}
                        uploading={!!r.pending}
                        onRemove={
                          loading
                            ? undefined
                            : () => removeAttachedResource(r.id)
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_15%,transparent)]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setPickerOpen((o) => !o)}
                        disabled={loading}
                        aria-label="Attach from my library"
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                          pickerOpen && 'bg-primary/10 text-primary',
                        )}
                      >
                        <Library className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Attach from library
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || uploadingFiles}
                        aria-label="Upload files"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <FileUp className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Upload files</TooltipContent>
                  </Tooltip>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!loading) send();
                      }
                    }}
                    placeholder={
                      attachedResources.length
                        ? `Ask about ${attachedResources.length} attached file${attachedResources.length === 1 ? '' : 's'}… (Enter to send, Shift+Enter for newline)`
                        : 'Ask anything about your courses… (Enter to send, Shift+Enter for newline)'
                    }
                    rows={1}
                    disabled={loading}
                    aria-label="Message"
                    data-testid="chat-input"
                    className="max-h-48 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        size="icon"
                        disabled={
                          loading
                            ? false
                            : (!input.trim() &&
                                attachedResources.length === 0) ||
                              uploadingFiles
                        }
                        aria-label={
                          loading ? 'Stop generating' : 'Send message'
                        }
                        data-testid="chat-send"
                        className={cn(
                          'h-9 w-9 shrink-0 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]',
                          loading && 'bg-destructive hover:bg-destructive/90',
                        )}
                      >
                        {loading ? (
                          <Square
                            className="h-[16px] w-[16px] fill-current"
                            aria-hidden
                          />
                        ) : (
                          <ArrowUp className="h-[18px] w-[18px]" aria-hidden />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {loading ? 'Stop' : 'Send'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-muted-foreground">
                  <span>
                    Answers are grounded in your authorised materials.
                    <span className="ml-1 rounded-md bg-muted px-1 py-0.5 font-mono text-[10px]">
                      Enter
                    </span>
                    <span className="mx-0.5">to send ·</span>
                    <span className="rounded-md bg-muted px-1 py-0.5 font-mono text-[10px]">
                      Shift+Enter
                    </span>
                    <span className="ml-0.5">newline</span>
                  </span>
                  <span className="hidden sm:inline">
                    AI can make mistakes — verify with sources.
                  </span>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Source resource preview dialog */}
        <ResourceDetailDialog
          resource={
            openedResourceId
              ? { id: openedResourceId } // Dialog will fetch full details via preview API once we have a real object; but dialog expects the whole resource.
              : null
          }
          open={!!openedResourceId}
          onClose={() => setOpenedResourceId(null)}
        />
        <SourceDetailDialog
          source={sourceDetail}
          open={!!sourceDetail}
          onClose={() => setSourceDetail(null)}
          onOpenResource={openSourceResource}
        />
        <ConfirmDialog
          open={!!sessionToDelete}
          title="Delete conversation?"
          description={`"${sessionToDelete?.title || 'Untitled chat'}" will be permanently deleted. This cannot be undone.`}
          onCancel={() => setSessionToDelete(null)}
          onConfirm={() => {
            const s = sessionToDelete;
            setSessionToDelete(null);
            deleteSession(s);
          }}
          confirmLabel="Delete"
          destructive
        />
      </AppShell>
    </TooltipProvider>
  );
}
