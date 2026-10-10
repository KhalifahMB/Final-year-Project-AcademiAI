import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { chatApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { getFileType } from '@/lib/filetypes';
import {
  Clock,
  Copy,
  CopyCheck,
  HardDriveUpload,
  History as HistoryIcon,
  Library,
  Link2,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Avatar from '@/components/shared/Avatar';
import CitedMarkdown from '@/components/chat/citedMarkdown';

/* ---------------- Source chip in sources rail ---------------- */

export function SourceCard({
  source,
  active,
  onClick,
  onOpenResource,
  onDetailClick,
}) {
  const meta = getFileType(source.resource_title || '', source.mime_type || '');
  const FileIcon = meta.icon;
  // No nested buttons: the header row is the select toggle, the detail
  // actions sit beneath it as siblings.
  return (
    <div
      className={cn(
        'group w-full rounded-lg border p-2.5 text-left transition-colors',
        active
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/60 bg-background/60 hover:border-primary/30 hover:bg-accent/30',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${active ? 'Deselect' : 'Select'} source ${source.rank}: ${source.resource_title || source.title || ''}`}
        className="flex w-full items-start gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold',
            meta.tint,
          )}
        >
          {source.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">
            {source.resource_title || source.title || `Source ${source.rank}`}
          </p>
          {source.chunk_text && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/70">
              {source.chunk_text.slice(0, 150)}…
            </p>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <FileIcon className="h-3 w-3" aria-hidden />
            <span className="uppercase tracking-wide">{meta.label}</span>
            {source.version_number && <span>· v{source.version_number}</span>}
            {source.similarity_score != null && (
              <span>
                · {Math.round(Number(source.similarity_score) * 100)}% match
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onDetailClick) onDetailClick(source);
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
        >
          <Link2 className="h-2.5 w-2.5" aria-hidden /> View details
        </button>
        {source.resource_id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenResource) onOpenResource(source.resource_id);
            }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Open resource
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/70">
          · {source.retrieval_method || 'hybrid'}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Message actions ---------------- */

export function ConfidenceBadge({ confidence, retrieval_ms }) {
  if (!confidence || confidence === 'none') return null;
  const map = {
    high: {
      label: 'Grounded',
      cls: 'bg-[var(--success-soft)] text-[var(--success)]',
      icon: '●',
    },
    medium: {
      label: 'Partial',
      cls: 'bg-[var(--warn-soft)] text-[var(--warn)]',
      icon: '◐',
    },
    low: {
      label: 'Ungrounded',
      cls: 'bg-[var(--danger-soft)] text-[var(--danger)]',
      icon: '○',
    },
  };
  const { label, cls, icon } = map[confidence] || map.medium;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        cls,
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
      {retrieval_ms != null && (
        <span className="opacity-60">· {retrieval_ms}ms</span>
      )}
    </span>
  );
}

export function MessageActions({
  content,
  onRegenerate,
  isLastAssistant,
  messageId,
  initialRating,
}) {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState(
    initialRating === 1 ? 'up' : initialRating === -1 ? 'down' : null,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const setRating = async (val) => {
    const next = reaction === val ? null : val;
    setReaction(next);
    if (!messageId) return;
    try {
      await chatApi.rateMessage(
        messageId,
        next === 'up' ? 1 : next === 'down' ? -1 : 0,
      );
    } catch {
      /* feedback is optimistic; ignore failure */
    }
  };

  return (
    // Hover-only actions strand touch + keyboard users: reveal on
    // focus-within everywhere and keep visible on coarse pointers.
    <div className="mt-2 flex items-center gap-0.5 transition-opacity focus-within:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Copy"
          >
            {copied ? (
              <CopyCheck className="h-3.5 w-3.5 text-[var(--success)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Copy</TooltipContent>
      </Tooltip>
      {isLastAssistant && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Regenerate</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setRating('up')}
            className={cn(
              'rounded-md p-1.5 transition-colors hover:bg-muted',
              reaction === 'up'
                ? 'text-[var(--success)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="Good response"
            aria-pressed={reaction === 'up'}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Good response</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setRating('down')}
            className={cn(
              'rounded-md p-1.5 transition-colors hover:bg-muted',
              reaction === 'down'
                ? 'text-[var(--danger)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="Bad response"
            aria-pressed={reaction === 'down'}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Bad response</TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ---------------- Message bubble ---------------- */

export function MessageBubble({
  msg,
  isLastAssistant,
  onSourceClick,
  _onOpenSourceResource,
  onRegenerate,
  user,
  identity,
}) {
  const isUser = msg.role === 'user';
  const sources = msg.sources || [];
  const isStreaming = !!msg.streaming;

  return (
    <div className={cn('group flex gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar user={user} className="h-7 w-7" />
      ) : (
        <img
          src={identity?.avatar || '/avatars/tutor.svg'}
          alt=""
          aria-hidden
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
          draggable="false"
        />
      )}
      <div className={cn('min-w-0 flex-1', isUser ? 'text-right' : '')}>
        <div
          className={cn(
            'inline-block max-w-full rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-primary/10 text-foreground'
              : 'rounded-tl-sm',
          )}
        >
          {/* User attachments */}
          {isUser &&
            Array.isArray(msg.attachments) &&
            msg.attachments.length > 0 && (
              <ul className="mb-2.5 flex flex-wrap gap-1.5 text-right">
                {msg.attachments.map((a, i) => {
                  const ft = getFileType(a.title || '', a.mime_type || '');
                  const AI = ft.icon;
                  return (
                    <li
                      key={a.id || i}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-[11px]"
                    >
                      <AI className="h-3 w-3 text-primary" aria-hidden />
                      <span className="max-w-[200px] truncate">{a.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          <div
            className={cn(
              'text-left',
              isUser ? '[&_p]:text-left [&_ul]:text-left [&_ol]:text-left' : '',
            )}
          >
            <CitedMarkdown
              content={msg.content || (isStreaming ? '' : '')}
              sources={sources}
              onSourceClick={onSourceClick}
            />
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/70 align-middle" />
            )}
          </div>
        </div>
        {/* Footer */}
        <div
          className={cn(
            'mt-1 flex items-center gap-2 text-[10px] text-muted-foreground',
            isUser ? 'justify-end' : '',
          )}
        >
          {msg.created_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              {formatDistanceToNow(new Date(msg.created_at), {
                addSuffix: true,
              })}
            </span>
          )}
          {!isUser && !isStreaming && (
            <ConfidenceBadge
              confidence={msg.confidence}
              retrieval_ms={msg.retrieval_ms}
            />
          )}
          {!isUser && (
            <MessageActions
              content={msg.content}
              isLastAssistant={isLastAssistant}
              onRegenerate={onRegenerate}
              messageId={msg.id}
              initialRating={msg.rating}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Attachment chip ---------------- */

export function AttachmentChip({ attachment, onRemove, uploading }) {
  const fromDisk = !!attachment.pending || attachment.source === 'upload';
  const SourceIcon = fromDisk ? HardDriveUpload : Library;
  const ft = getFileType(attachment.title || '', attachment.mime_type || '');
  const FileIcon = ft.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-[11px]">
      {uploading ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <FileIcon className="h-3 w-3 text-primary" aria-hidden />
      )}
      <span className="max-w-[180px] truncate">
        {attachment.title || 'Uploading…'}
      </span>
      <SourceIcon
        className="h-2.5 w-2.5 shrink-0 text-muted-foreground/70"
        aria-hidden
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.title}`}
          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

/* ---------------- History sidebar item ---------------- */

export function HistoryItem({ s, active, onClick, onDelete }) {
  const timeLabel = useMemo(() => {
    const d = s.updated_at || s.created_at;
    if (!d) return '';
    try {
      return formatDistanceToNow(new Date(d), { addSuffix: true });
    } catch {
      return '';
    }
  }, [s.updated_at, s.created_at]);
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors',
          active
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-1.5">
          <HistoryIcon className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          <span className="truncate text-[12.5px]">
            {s.title || 'Untitled chat'}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] opacity-70">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {timeLabel}
          {s.message_count != null && <span>· {s.message_count} msgs</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onDelete) onDelete(s);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        aria-label={`Delete conversation ${s.title || 'Untitled chat'}`}
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
