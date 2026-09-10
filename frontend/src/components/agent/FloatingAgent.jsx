import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAgent } from '@/hooks/useAgent';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import {
  ChevronDown,
  History,
  Loader2,
  Minus,
  Send,
  Settings2,
  Square,
  Trash2,
} from 'lucide-react';
import AgentSettings from '@/components/agent/AgentSettings';
import { useNotifications } from '@/hooks/useNotifications';

const ROUTE_CONTEXT = {
  '/dashboard': 'dashboard',
  '/plans': 'plans',
  '/resources': 'resources',
  '/chat': 'chat',
};

function getContextType(pathname) {
  for (const [route, ctx] of Object.entries(ROUTE_CONTEXT)) {
    if (pathname.startsWith(route)) return ctx;
  }
  return 'dashboard';
}

const PRESENCE_STYLES = {
  online: 'bg-[var(--success)]',
  idle: 'bg-[var(--warn)]',
  focus: 'bg-[var(--accent)]',
  offline: 'bg-[var(--muted)]',
};

const DEFAULT_TONE = {
  mastery: 'var(--accent)',
  harmony: 'var(--success)',
  plan: 'var(--info)',
  literature: 'var(--warn)',
  analytics: 'var(--muted)',
  exec: 'var(--danger)',
};

export default function FloatingAgent() {
  const {
    messages,
    loading,
    isOpen,
    agents,
    agentKey,
    setAgent,
    identity,
    settings,
    available,
    sessions,
    activeSession,
    selectSession,
    deleteSession,
    sendMessage,
    stopStreaming,
    toggleOpen,
  } = useAgent();
  const { unreadCount, hasUnread, markAllRead } = useNotifications();
  const location = useLocation();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('academiai:agent-position');
      return saved
        ? JSON.parse(saved)
        : { x: window.innerWidth - 80, y: window.innerHeight - 80 };
    } catch {
      return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);
  const dragMovedRef = useRef(false);
  const orbRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const enabled = settings.enabled !== false;

  useEffect(() => {
    localStorage.setItem('academiai:agent-position', JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [messages, reducedMotion]);

  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (wasOpenRef.current) {
      orbRef.current?.focus?.();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Opening the agent acknowledges the alerts: clear the badge.
  useEffect(() => {
    if (isOpen && hasUnread) {
      markAllRead().catch(() => {});
    }
  }, [isOpen, hasUnread, markAllRead]);

  // Unified pointer drag (mouse + touch). A drag that actually moves never
  // toggles the panel: only a near-stationary press counts as a click.
  const handleOrbPointerDown = useCallback(
    (e) => {
      dragMovedRef.current = false;
      dragStartRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setIsDragging(true);
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const s = dragStartRef.current;
      if (!s) return;
      if (Math.abs(e.clientX - s.startX) + Math.abs(e.clientY - s.startY) > 5) {
        dragMovedRef.current = true;
      }
      const newX = Math.max(
        0,
        Math.min(window.innerWidth - 60, s.origX + (e.clientX - s.startX)),
      );
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - 60, s.origY + (e.clientY - s.startY)),
      );
      setPosition({ x: newX, y: newY });
    };

    const handleUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDragging]);

  const handleOrbClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    toggleOpen();
  }, [toggleOpen]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    const contextType = getContextType(location.pathname);
    sendMessage(input.trim(), contextType);
    setInput('');
  }, [input, loading, location.pathname, sendMessage]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!enabled) return null;

  const avatarSrc = identity?.avatar || '/avatars/tutor.svg';
  const presenceClass = available
    ? PRESENCE_STYLES[identity?.presence] || PRESENCE_STYLES.online
    : PRESENCE_STYLES.offline;
  const agentToneColor = DEFAULT_TONE[identity?.tone] || 'var(--accent)';

  return (
    <>
      <div
        className="fixed z-50 select-none"
        style={{ left: position.x, top: position.y }}
      >
        <button
          ref={orbRef}
          type="button"
          onClick={handleOrbClick}
          onPointerDown={handleOrbPointerDown}
          className={cn(
            'group flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg transition-all',
            'bg-[var(--surface-2)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]/60',
            'hover:shadow-xl hover:scale-105 active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
            isOpen && 'ring-[var(--accent)]',
          )}
          aria-label={isOpen ? 'Close AI agent' : 'Open AI agent'}
          aria-expanded={isOpen}
          title={
            available
              ? `${identity?.name || 'AI Agent'} — drag to move`
              : 'Agent unavailable — service is offline'
          }
        >
          <img
            src={avatarSrc}
            alt=""
            className={cn(
              'h-full w-full object-cover transition-transform',
              isOpen && 'scale-90 opacity-70',
            )}
            draggable={false}
          />
        </button>
        {!isOpen && (
          <span
            aria-hidden
            className={cn(
              'absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-[var(--bg)]',
              presenceClass,
            )}
          />
        )}
        {!isOpen && hasUnread && (
          <span
            role="status"
            title={`${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`}
            className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-[700] text-[var(--on-accent)] shadow ring-2 ring-[var(--bg)]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${identity?.name || 'AI Agent'} assistant`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleOpen();
          }}
          className="fixed z-50 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-pop)] backdrop-blur-xl"
          style={{
            right: Math.max(16, window.innerWidth - position.x - 420),
            top: Math.max(
              16,
              Math.min(position.y - 480, window.innerHeight - 520),
            ),
            height: 'min(500px, calc(100vh - 32px))',
          }}
        >
          {/* Header: agent identity + presence */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative shrink-0">
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-9 w-9 rounded-full ring-1 ring-[var(--border)] object-cover"
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--surface)]',
                    presenceClass,
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="truncate text-[14px] font-[640] leading-tight">
                    {identity?.name || 'AI Agent'}
                  </p>
                  {agents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAgents((v) => !v)}
                      aria-label="Switch agent"
                      title="Switch agent"
                      className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="truncate text-[10.5px] text-[var(--muted)]">
                  {identity?.guardian} · {identity?.presence_label || 'Available'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowHistory(false);
                  setShowSettings(true);
                }}
                aria-label="Agent settings"
                title="Agent settings"
                className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setShowHistory((v) => !v);
                }}
                aria-label="Conversation history"
                title="Conversation history"
                className={cn(
                  'rounded-md p-1.5 hover:bg-[var(--hover)]',
                  showHistory ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]',
                )}
              >
                <History className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                aria-label="Minimize agent"
                title="Minimize"
                className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Agent switcher */}
          {showAgents && (
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/40 p-2">
              <div className="flex flex-wrap gap-1.5">
                {agents.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => {
                      setAgent(a.key);
                      setShowAgents(false);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                      a.key === agentKey
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
                    )}
                  >
                    <img src={a.avatar} alt="" className="h-4 w-4 rounded-full" />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History rail */}
          {showHistory && (
            <div className="max-h-[220px] overflow-y-auto border-b border-[var(--border)] p-2">
              <p className="px-2 pb-1 text-[10.5px] font-[600] uppercase tracking-wide text-[var(--muted)]">
                Conversations
              </p>
              {sessions.length === 0 ? (
                <p className="px-2 py-2 text-[12px] text-[var(--muted)]">
                  No past conversations yet.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--hover)]',
                        s.id === activeSession?.id && 'bg-[var(--surface-2)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectSession(s.id)}
                        className="min-w-0 flex-1 text-left"
                        title={s.title}
                      >
                        <p className="truncate text-[12.5px] font-[560]">
                          {s.title}
                        </p>
                        <p className="text-[10.5px] text-[var(--muted)]">
                          {new Date(s.last_active_at).toLocaleString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession(s.id)}
                        aria-label="Delete conversation"
                        className="rounded p-1 text-[var(--muted)] opacity-0 hover:bg-[var(--surface-2)] hover:text-[var(--danger)] group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="max-h-[300px] overflow-y-auto border-b border-[var(--border)] p-3">
              <AgentSettings embedded onClose={() => setShowSettings(false)} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl overflow-hidden ring-1 ring-[var(--border)]"
                  style={{ backgroundColor: agentToneColor, opacity: 0.92 }}
                >
                  <img src={avatarSrc} alt="" className="h-10 w-10" />
                </span>
                {available ? (
                  <>
                    <p className="mt-3 text-sm font-[620]">How can I help?</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {identity?.tagline}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {[
                        "What's my progress?",
                        'Create a study plan',
                        'Show my deadlines',
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setInput(q);
                            setTimeout(
                              () =>
                                sendMessage(q, getContextType(location.pathname)),
                              0,
                            );
                          }}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm font-[620] text-[var(--muted)]">
                    Agent unavailable
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                        msg.role === 'user'
                          ? 'rounded-br-sm bg-[var(--accent-soft)] text-[var(--fg)]'
                          : 'rounded-bl-sm bg-[var(--surface-2)] text-[var(--fg)]',
                      )}
                    >
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {msg.toolCalls.map((tc, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]"
                            >
                              <Loader2
                                className={cn(
                                  'h-2.5 w-2.5',
                                  tc.result
                                    ? 'text-[var(--success)]'
                                    : 'animate-spin text-[var(--accent)]',
                                )}
                              />
                              <span>{tc.tool.replace(/_/g, ' ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.content ? (
                        <div className="[&>p]:mb-2 last:[&>p]:mb-0">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : msg.streaming ? (
                        <span className="inline-block h-4 w-1.5 animate-pulse bg-[var(--accent)]/70" />
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]/80 p-3">
            <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-1.5 focus-within:border-[var(--accent)]/50 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  available
                    ? `Ask ${identity?.name || 'the agent'}…`
                    : 'Agent unavailable'
                }
                aria-label="Ask the agent"
                rows={1}
                disabled={!available}
                className="max-h-24 min-h-[32px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] leading-relaxed shadow-none focus-visible:ring-0 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={loading ? stopStreaming : handleSend}
                disabled={!available || (!loading && !input.trim())}
                aria-label={loading ? 'Stop generating' : 'Send message'}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  loading
                    ? 'bg-[var(--danger)] text-[var(--on-accent)] hover:bg-[var(--danger)]/90'
                    : 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50',
                )}
              >
                {loading ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}