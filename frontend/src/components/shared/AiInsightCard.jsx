import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { Lightbulb, Sparkles, X } from 'lucide-react';

// Dismissal is remembered for the rest of the day, per dashboard, so the
// banner reads as a nudge rather than permanent chrome.
function dismissKey(dashboardType) {
  const day = new Date().toISOString().slice(0, 10);
  return `academiai:ai-insight-dismissed:${dashboardType}:${day}`;
}

function readDismissed(dashboardType) {
  try {
    return window.sessionStorage.getItem(dismissKey(dashboardType)) === '1';
  } catch {
    return false;
  }
}

export default function AiInsightCard({ dashboardType = 'student', className, 'data-testid': testId }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(dashboardType));
  const { data, isLoading } = useQuery({
    queryKey: ['ai-insight', dashboardType],
    queryFn: () => dashboardApi.aiInsight(dashboardType),
    staleTime: 1800000, // 30 minutes
    retry: 1,
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(dismissKey(dashboardType), '1');
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  };

  if (isLoading) {
    return (
      <div
        className={cn('flex items-center gap-3 rounded-xl border bg-card px-4 py-3', className)}
        data-testid={testId}
      >
        <span className="skeleton h-7 w-7 shrink-0 rounded-md" />
        <span className="skeleton h-3.5 w-1/2 rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl border bg-card px-4 py-3', className)}
      data-testid={testId}
      role="status"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI Insight
          </span>
          {data.confidence != null && (
            <span className="text-[10px] text-muted-foreground/70">
              confidence: {Math.round(data.confidence * 100)}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13.5px] font-semibold leading-snug">{data.headline}</p>
        {data.body && (
          <p className="mt-0.5 truncate text-[12.5px] leading-relaxed text-muted-foreground">
            {data.body}
          </p>
        )}
        {data.suggested_actions && data.suggested_actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.suggested_actions.map((action, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                <Lightbulb className="h-3 w-3" aria-hidden />
                {action}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss AI insight"
        className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
