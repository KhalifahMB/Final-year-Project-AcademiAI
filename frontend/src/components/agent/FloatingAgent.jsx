import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAgent } from '@/hooks/useAgent';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  Send,
  Square,
  X,
  Trash2,
  Minus,
  Loader2,
  Sparkles,
} from 'lucide-react';

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

export default function FloatingAgent() {
  const {
    messages,
    loading,
    isOpen,
    sendMessage,
    stopStreaming,
    clearMessages,
    toggleOpen,
  } = useAgent();
  const location = useLocation();
  const [input, setInput] = useState('');
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
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('academiai:agent-settings');
      return saved ? JSON.parse(saved) : { enabled: true };
    } catch {
      return { enabled: true };
    }
  });
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
    localStorage.setItem('academiai:agent-settings', JSON.stringify(settings));
  }, [settings]);

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
      // Return focus to the launcher, but only when the panel actually
      // closes (not on first mount).
      orbRef.current?.focus?.();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      setSettings((prev) => ({ ...prev, enabled: e.detail?.enabled }));
    };
    window.addEventListener('academiai:agent-settings-changed', handler);
    return () => window.removeEventListener('academiai:agent-settings-changed', handler);
  }, []);

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
    // A real drag ends with a click — swallow it so dragging never
    // opens/closes the panel by accident.
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
            'group flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all',
            'bg-primary text-primary-foreground',
            'hover:shadow-xl hover:scale-105 active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-ring',
            isOpen && 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          aria-label={isOpen ? 'Close AI agent' : 'Open AI agent'}
          aria-expanded={isOpen}
          title="AI Agent — drag to move"
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </button>
        {!isOpen && (
          <span aria-hidden className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-[8px] font-bold text-[var(--bg)]">
            AI
          </span>
        )}
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="AI agent"
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleOpen();
          }}
          className="fixed z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur-xl"
          style={{
            right: Math.max(16, window.innerWidth - position.x - 400),
            top: Math.max(
              16,
              Math.min(position.y - 460, window.innerHeight - 500),
            ),
            height: 'min(480px, calc(100vh - 32px))',
          }}
        >
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">AI Agent</p>
                <p className="text-[10px] text-muted-foreground">
                  Ask me anything
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  aria-label="Clear agent chat"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleOpen}
                aria-label="Minimize agent"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium">How can I help?</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  I can help with study plans, progress tracking, and more.
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
                      className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
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
                        'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-primary/10 text-foreground rounded-br-sm'
                          : 'bg-muted/50 text-foreground rounded-bl-sm',
                      )}
                    >
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {msg.toolCalls.map((tc, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                            >
                              <Loader2
                                className={cn(
                                  'h-2.5 w-2.5',
                                  tc.result
                                    ? 'text-[var(--success)]'
                                    : 'animate-spin text-primary',
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
                        <span className="inline-block h-4 w-1.5 animate-pulse bg-primary/70" />
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t bg-background/80 p-3">
            <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_15%,transparent)]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the agent…"
                aria-label="Ask the agent"
                rows={1}
                className="max-h-24 min-h-[32px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={loading ? stopStreaming : handleSend}
                disabled={!loading && !input.trim()}
                aria-label={loading ? 'Stop generating' : 'Send message'}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  loading
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
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
