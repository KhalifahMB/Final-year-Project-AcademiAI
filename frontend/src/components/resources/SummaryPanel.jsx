import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Clock,
  History,
  Loader2,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return 'just now';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ''; }
}

export default function SummaryPanel({
  activeSummary,
  allSummaries = [],
  showHistory,
  onToggleHistory,
  onSelectSummary,
  onDismiss,
  canDeleteSummary,
  onDeleteSummary,
  deletingId,
  summaryLoading,
  summaryError,
  workerOutdatedWarned,
}) {
  return (
    <>
      {activeSummary && (
        <div className="shrink-0 border-b ai-gradient">
          <div className="mx-auto max-w-4xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">AI Summary</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10">
                      <Clock className="h-3 w-3" aria-hidden />
                      {formatDate(activeSummary.created_at)}
                    </span>
                    {activeSummary.created_by_name && (
                      <span className="hidden items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10 sm:inline-flex">
                        <User className="h-3 w-3" aria-hidden />
                        {activeSummary.created_by_name}
                      </span>
                    )}
                    {activeSummary.ephemeral && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        Not saved — restart Celery
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {canDeleteSummary(activeSummary) && (
                      <button
                        type="button"
                        onClick={() => onDeleteSummary(activeSummary.id)}
                        disabled={deletingId === activeSummary.id}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                        title={activeSummary.ephemeral ? 'Dismiss' : 'Delete this summary'}
                      >
                        {deletingId === activeSummary.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3 w-3" aria-hidden />
                        )}
                        {activeSummary.ephemeral ? 'Dismiss' : 'Delete'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Dismiss summary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="prose-academic mt-2 max-w-none text-[13.5px] leading-relaxed">
                  <ReactMarkdown>{activeSummary.summary || 'No summary text returned.'}</ReactMarkdown>
                </div>

                {Array.isArray(activeSummary.key_points) && activeSummary.key_points.length > 0 && (
                  <div className="mt-3 rounded-lg border bg-background/60 p-3 backdrop-blur">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Key points
                    </p>
                    <ul className="list-disc space-y-0.5 pl-5 text-[12.5px]">
                      {activeSummary.key_points.map((kp, i) => (
                        <li key={i}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {allSummaries.length > 1 && (
                  <button
                    type="button"
                    onClick={onToggleHistory}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    {showHistory ? 'Hide summary history' : `View all ${allSummaries.length} summaries`}
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                )}
                {showHistory && allSummaries.length > 1 && (
                  <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border bg-background/60 p-2 backdrop-blur">
                    {allSummaries.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelectSummary(s.id)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                          String(s.id) === String(activeSummary?.id) && 'bg-primary/10 ring-1 ring-primary/20',
                        )}
                      >
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-semibold text-white">
                          <Sparkles className="h-3 w-3" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate">
                              {(s.summary || '').split('\n')[0]?.slice(0, 100) || '(empty)'}
                            </span>
                            {s.ephemeral && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                unsaved
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden />
                            {formatDate(s.created_at)}
                            {s.created_by_name && (
                              <>
                                <span>•</span>
                                <User className="h-3 w-3" aria-hidden />
                                {s.created_by_name}
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {workerOutdatedWarned && (
        <div className="shrink-0 border-b bg-amber-50 px-4 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <strong>Heads up:</strong> Summaries are showing but not being saved right now. Please contact your administrator so they can restore saving.
        </div>
      )}
      {summaryLoading && (
        <div className="shrink-0 border-b bg-primary/5 px-5 py-2.5">
          <div className="mx-auto flex max-w-4xl items-center gap-2 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Generating AI summary… this takes a few seconds. It will be saved automatically.
          </div>
        </div>
      )}
      {summaryError && !summaryLoading && (
        <div className="shrink-0 border-b bg-red-500/10 px-5 py-2 text-xs text-red-700 dark:text-red-400">
          {summaryError}
        </div>
      )}
    </>
  );
}
