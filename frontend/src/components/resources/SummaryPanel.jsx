import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronRight,
  Clock,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
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

function shortWhen(iso) {
  if (!iso) return 'now';
  try { return formatDistanceToNow(new Date(iso)).replace(/^about\s+/, ''); }
  catch { return ''; }
}

/**
 * AI summary reader for the resource detail view.
 *
 * Rendered as a floating card (not a full-bleed banner) so long-form markdown
 * sits on an opaque surface, per the material system. Collapsed it degrades to
 * a slim launcher row.
 */
export default function SummaryPanel({
  activeSummary,
  allSummaries = [],
  show = true,
  onShow,
  onSelectSummary,
  onDismiss,
  canDeleteSummary,
  onDeleteSummary,
  deletingId,
  summaryLoading,
  summaryError,
  requestSummary,
  savedCount = 0,
  workerOutdatedWarned = false,
}) {
  const keyPoints = Array.isArray(activeSummary?.key_points)
    ? activeSummary.key_points
    : [];

  return (
    <>
      {/* Collapsed trigger — slim, keeps the preview visible */}
      {activeSummary && !show && (
        <div className="shrink-0 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-1.5 sm:px-5">
            <button
              type="button"
              onClick={() => onShow?.()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              View AI summary
              <ChevronRight className="h-3 w-3" aria-hidden />
            </button>
            {savedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Sparkles className="h-3 w-3" aria-hidden />
                {savedCount} saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded → floating card */}
      {show && activeSummary && (
        <div className="shrink-0 overflow-hidden border-b">
          <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-5">
            <div className="card-surface overflow-hidden">
              {/* Accent hairline — single accent economy */}
              <div
                className="h-[3px] w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent)] to-[var(--info)]"
                aria-hidden
              />

              {/* Card header */}
              <div className="flex items-start gap-2.5 px-4 pt-3 sm:px-5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold tracking-tight">AI summary</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      {formatDate(activeSummary.created_at)}
                    </span>
                    {activeSummary.created_by_name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        <User className="h-3 w-3" aria-hidden />
                        {activeSummary.created_by_name}
                      </span>
                    )}
                    {activeSummary.ephemeral && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warn)]/40 bg-[var(--warn-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warn)]">
                        Not saved — restart Celery
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {requestSummary && (
                    <button
                      type="button"
                      onClick={requestSummary}
                      disabled={summaryLoading}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                      title="Generate a new summary"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      New
                    </button>
                  )}
                  {canDeleteSummary(activeSummary) && (
                    <button
                      type="button"
                      onClick={() => onDeleteSummary(activeSummary.id)}
                      disabled={deletingId === activeSummary.id}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-50"
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
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss summary"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              {/* Body — opaque surface, never behind glass */}
              <div className="px-4 pb-4 pt-3 sm:px-5">
                <div className="prose-academic max-w-none text-[13.5px] leading-relaxed">
                  <ReactMarkdown>{activeSummary.summary || 'No summary text returned.'}</ReactMarkdown>
                </div>

                {keyPoints.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" aria-hidden />
                      Key points
                    </p>
                    <ul className="space-y-1.5">
                      {keyPoints.map((kp, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                            <Check className="h-2.5 w-2.5" aria-hidden />
                          </span>
                          <span className="min-w-0">{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {allSummaries.length > 1 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <History className="h-3.5 w-3.5" aria-hidden />
                      All versions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {allSummaries.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectSummary(s.id)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                            String(s.id) === String(activeSummary.id)
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <Sparkles className="h-3 w-3" aria-hidden />
                          #{allSummaries.length - i}
                          <span className="text-border">·</span>
                          {shortWhen(s.created_at)}
                          {s.ephemeral && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]"
                              title="Not saved"
                              aria-label="Not saved"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status banners — token-driven, kept thin */}
      {workerOutdatedWarned && (
        <div className="shrink-0 border-b bg-[var(--warn-soft)] px-5 py-2 text-xs text-[var(--warn)]" role="alert">
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Summaries can't be saved yet — the background worker is out of sync. Restart Celery to persist new summaries.
          </div>
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
      {!summaryLoading && summaryError && (
        <div className="shrink-0 border-b bg-[var(--danger-soft)] px-5 py-2 text-xs text-[var(--danger)]" role="alert">
          <div className="mx-auto max-w-4xl">{summaryError}</div>
        </div>
      )}
    </>
  );
}