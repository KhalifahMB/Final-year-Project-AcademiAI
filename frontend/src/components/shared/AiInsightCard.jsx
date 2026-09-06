import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { Lightbulb, Sparkles } from 'lucide-react';

export default function AiInsightCard({ dashboardType = 'student', className, 'data-testid': testId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-insight', dashboardType],
    queryFn: () => dashboardApi.aiInsight(dashboardType),
    staleTime: 1800000, // 30 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border bg-card p-4', className)} data-testid={testId}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold text-muted-foreground">AI Insight</span>
        </div>
        <div className="skeleton h-4 w-3/4 rounded mb-2" />
        <div className="skeleton h-3 w-full rounded mb-1" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={cn('rounded-xl border bg-gradient-to-br from-primary/5 to-accent/5 p-4', className)} data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Insight</span>
        {data.confidence != null && (
          <span className="ml-auto text-[10px] text-muted-foreground/70">
            confidence: {Math.round(data.confidence * 100)}%
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold leading-snug">{data.headline}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{data.body}</p>
      {data.suggested_actions && data.suggested_actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
  );
}
