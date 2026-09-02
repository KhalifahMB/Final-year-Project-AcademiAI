import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';

export default function AgentSettings() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('academiai:agent-settings');
      return saved ? JSON.parse(saved).enabled !== false : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const current = (() => {
      try {
        return JSON.parse(
          localStorage.getItem('academiai:agent-settings') || '{}',
        );
      } catch {
        return {};
      }
    })();
    localStorage.setItem(
      'academiai:agent-settings',
      JSON.stringify({ ...current, enabled }),
    );
    window.dispatchEvent(
      new CustomEvent('academiai:agent-settings-changed', {
        detail: { enabled },
      }),
    );
  }, [enabled]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">AI Agent Widget</p>
          <p className="text-[11px] text-muted-foreground">
            Show or hide the floating AI assistant button on all screens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            enabled ? 'bg-primary' : 'bg-muted',
          )}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle AI agent widget"
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}
