import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { chatApi } from '@/services/api';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getFileType } from '@/lib/filetypes';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { toast } from 'sonner';
import {
 ArrowUp,
 Check,
 ChevronLeft,
 CircleAlert,
 Clock,
 Copy,
 CopyCheck,
 FileText,
 FileUp,
 GraduationCap,
 HardDriveUpload,
 History as HistoryIcon,
 Library,
 Link2,
 Loader2,
 MessageSquarePlus,
  Menu,
 PanelRightClose,
 PanelRightOpen,
 Pencil,
 RefreshCw,
 Search,
 Sparkles,
 Square,
 ThumbsDown,
 ThumbsUp,
 Trash2,
 X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SUGGESTIONS = [
 {
 icon: Sparkles,
 title: 'Summarize my materials',
 prompt: 'Summarize the key ideas from my course materials into concise bullet points.',
 },
 {
 icon: FileText,
 title: 'Explain a concept',
 prompt: 'Explain a concept I am stuck on, step by step with examples.',
 },
 {
 icon: GraduationCap,
 title: 'Exam prep',
 prompt: 'Based on my course materials, which topics are most likely to appear on the exam? Generate 5 practice questions.',
 },
 {
 icon: Library,
 title: 'Compare sources',
 prompt: 'Compare and contrast the main arguments across the materials I have uploaded.',
 },
];

/* ---------------- Inline citation parser ---------------- */

/**
 * Look for [N] references in markdown text and replace them with
 * clickable chips that activate the corresponding source in the
 * right-hand sources rail. Non-matching numbers are left as-is.
 */
function renderCitedText(text, sources, onSourceClick) {
 if (!text) return text;
 // Only look for citations where there is an actual source with that rank.
 const rankSet = new Set((sources || []).map((s) => Number(s.rank)));
 const parts = [];
 const re = /\[(\d+)\]/g;
 let lastIdx = 0;
 let m;
 let key = 0;
 while ((m = re.exec(text)) !== null) {
 const n = Number(m[1]);
 if (rankSet.has(n)) {
 if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
 parts.push(
 <button
 type="button"
 key={`cite-${key++}-${n}`}
 onClick={() => onSourceClick && onSourceClick(n)}
 className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
 >
 {n}
 </button>,
 );
 lastIdx = m.index + m[0].length;
 }
 }
 if (lastIdx < text.length) parts.push(text.slice(lastIdx));
 return parts;
}

/* ---------------- Markdown content w/ citation chips ---------------- */

function MarkdownContent({ content, sources, onSourceClick }) {
 const components = useMemo(() => {
 const C = ({ children }) => renderCitedText(children, sources, onSourceClick);
 return {
 p: ({ children }) => (
 <p className="mb-3 last:mb-0 leading-relaxed">
 {typeof children === 'string'
 ? renderCitedText(children, sources, onSourceClick)
 : children}
 </p>
 ),
 li: ({ children }) => (
 <li className="leading-relaxed">{children}</li>
 ),
 ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
 ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
 h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold">{children}</h1>,
 h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold">{children}</h2>,
 h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold">{children}</h3>,
 blockquote: ({ children }) => (
 <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>
 ),
 a: ({ href, children }) => (
 <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{children}</a>
 ),
 code: ({ inline, className, children, ...rest }) =>
 inline
 ? <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px]" {...rest}>{children}</code>
 : <code className={className} {...rest}>{children}</code>,
 pre: ({ children }) => (
 <pre className="mb-3 overflow-x-auto rounded-lg bg-muted/70 p-3 text-[12.5px] last:mb-0">{children}</pre>
 ),
 table: ({ children }) => <div className="mb-3 overflow-x-auto last:mb-0"><table className="w-full border-collapse text-sm">{children}</table></div>,
 th: ({ children }) => <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>,
 td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
 // Replace [n] with chips inside plain-text runs
 span: C,
 };
 }, [sources, onSourceClick]);

 return (
 <ReactMarkdown
 remarkPlugins={[remarkMath]}
 rehypePlugins={[rehypeKatex]}
 components={components}
 >
 {content}
 </ReactMarkdown>
 );
}

/* ---------------- Source chip in sources rail ---------------- */

function SourceCard({ source, active, onClick, onOpenResource }) {
 const meta = getFileType(source.resource_title || '', source.mime_type || '');
 const FileIcon = meta.icon;
 return (
 <button
 type="button"
 onClick={onClick}
 className={cn(
 'group flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all',
 active
 ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
 : 'border-border/60 bg-background/60 hover:border-primary/30 hover:bg-accent/30',
 )}
 >
 <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold', meta.tint)}>
 {source.rank}
 </span>
 <div className="min-w-0 flex-1">
 <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{source.resource_title || source.title || `Source ${source.rank}`}</p>
 <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
 <FileIcon className="h-3 w-3" aria-hidden />
 <span className="uppercase tracking-wide">{meta.label}</span>
 {source.version_number && <span>· v{source.version_number}</span>}
 {source.similarity_score != null && (
 <span>· {Math.round(Number(source.similarity_score) * 100)}% match</span>
 )}
 </div>
 <div className="mt-1.5 flex items-center gap-1">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); if (onOpenResource && source.resource_id) onOpenResource(source.resource_id); }}
 className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
 disabled={!source.resource_id}
 >
 <Link2 className="h-2.5 w-2.5" aria-hidden /> Open
 </button>
 <span className="text-[10px] text-muted-foreground/70">· {source.retrieval_method || 'hybrid'}</span>
 </div>
 </div>
 </button>
 );
}

/* ---------------- Message actions ---------------- */

function MessageActions({ content, onRegenerate, isLastAssistant }) {
 const [copied, setCopied] = useState(false);
 const [reaction, setReaction] = useState(null);

 const copy = async () => {
 try {
 await navigator.clipboard.writeText(content || '');
 setCopied(true);
 setTimeout(() => setCopied(false), 1500);
 } catch {}
 };

 return (
 <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
 <Tooltip>
 <TooltipTrigger asChild>
 <button
 type="button"
 onClick={copy}
 className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
 aria-label="Copy"
 >
 {copied ? <CopyCheck className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
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
 onClick={() => setReaction((r) => (r === 'up' ? null : 'up'))}
 className={cn('rounded-md p-1.5 transition-colors hover:bg-muted', reaction === 'up' ? 'text-[var(--success)]' : 'text-muted-foreground hover:text-foreground')}
 aria-label="Good response"
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
 onClick={() => setReaction((r) => (r === 'down' ? null : 'down'))}
 className={cn('rounded-md p-1.5 transition-colors hover:bg-muted', reaction === 'down' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')}
 aria-label="Bad response"
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

function MessageBubble({ msg, isLastAssistant, onSourceClick, _onOpenSourceResource, onRegenerate }) {
 const isUser = msg.role === 'user';
 const sources = msg.sources || [];
 const isStreaming = !!msg.streaming;

 return (
 <div className={cn('group flex gap-3', isUser && 'flex-row-reverse')}>
 <span
 className={cn(
 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
 isUser
 ? 'bg-primary text-primary-foreground'
 : 'bg-[var(--accent)] text-[var(--on-accent)]',
 )}
 aria-hidden
 >
 {isUser ? <GraduationCap className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
 </span>
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
 {isUser && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
 <ul className="mb-2.5 flex flex-wrap gap-1.5 text-right">
 {msg.attachments.map((a, i) => {
 const ft = getFileType(a.title || '', a.mime_type || '');
 const AI = ft.icon;
 return (
 <li key={a.id || i} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-[11px]">
 <AI className="h-3 w-3 text-primary" aria-hidden />
 <span className="max-w-[200px] truncate">{a.title}</span>
 </li>
 );
 })}
 </ul>
 )}
 <div className={cn('text-left', isUser ? '[&_p]:text-left [&_ul]:text-left [&_ol]:text-left' : '')}>
 <MarkdownContent
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
 <div className={cn('mt-1 flex items-center gap-2 text-[10px] text-muted-foreground', isUser ? 'justify-end' : '')}>
 {msg.created_at && (
 <span className="inline-flex items-center gap-1">
 <Clock className="h-2.5 w-2.5" aria-hidden />
 {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
 </span>
 )}
 {!isUser && (
 <MessageActions content={msg.content} isLastAssistant={isLastAssistant} onRegenerate={onRegenerate} />
 )}
 </div>
 </div>
 </div>
 );
}

/* ---------------- Resource picker popover ---------------- */

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

 const ready = useMemo(
 () => (resources || []).filter((r) => r.processing_status === 'ready'),
 [resources],
 );
 const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

 useEffect(() => {
 if (!open) return;
 const onKey = (e) => { if (e.key === 'Escape') onClose(); };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, [open, onClose]);

 if (!open) return null;

 return (
 <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border bg-popover" role="dialog" aria-label="Attach materials">
 <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
 <div>
 <p className="text-xs font-semibold">Attach materials</p>
 <p className="text-[10px] text-muted-foreground">{selected.length} selected · click to toggle</p>
 </div>
 <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
 <X className="h-3.5 w-3.5" aria-hidden />
 </button>
 </div>
 <ul className="max-h-72 overflow-y-auto p-1.5">
 {error ? (
 <li className="px-3 py-6 text-center text-xs text-destructive">Could not load your materials.</li>
 ) : isLoading || resources === undefined ? (
 <li className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
 </li>
 ) : ready.length === 0 ? (
 <li className="px-3 py-6 text-center text-xs text-muted-foreground">No processed materials yet — upload one first.</li>
 ) : (
 ready.map((r) => {
 const isSelected = selectedIds.has(r.id);
 const ft = getFileType(r.title || '', r.mime_type || '');
 const FileIcon = ft.icon;
 return (
 <li key={r.id}>
 <button
 type="button"
 onClick={() => onToggle(r)}
 className={cn(
 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
 isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
 )}
 >
 <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]', isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')}>
 {isSelected && <Check className="h-3 w-3" />}
 </span>
 <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', ft.tint)}>
 <FileIcon className="h-3.5 w-3.5" aria-hidden />
 </span>
 <span className="min-w-0 flex-1">
 <span className="block truncate text-xs font-medium">{r.title}</span>
 <span className="block truncate text-[10px] capitalize text-muted-foreground">{r.visibility_scope} scope</span>
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

/* ---------------- Attachment chip ---------------- */

function AttachmentChip({ attachment, onRemove, uploading }) {
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
 <span className="max-w-[180px] truncate">{attachment.title || 'Uploading…'}</span>
 <SourceIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground/70" aria-hidden />
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

function HistoryItem({ s, active, onClick, onDelete }) {
 const timeLabel = useMemo(() => {
 const d = s.updated_at || s.created_at;
 if (!d) return '';
 try { return formatDistanceToNow(new Date(d), { addSuffix: true }); }
 catch { return ''; }
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
 <span className="truncate text-[12.5px]">{s.title || 'Untitled chat'}</span>
 </span>
 <span className="flex items-center gap-1.5 text-[10.5px] opacity-70">
 <Clock className="h-2.5 w-2.5" aria-hidden />
 {timeLabel}
 {s.message_count != null && <span>· {s.message_count} msgs</span>}
 </span>
 </button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(s); }}
 className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
 aria-label="Delete conversation"
 title="Delete"
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </div>
 );
}

/* ---------------- Page ---------------- */

export default function ChatPage() {
 const isMobile = useIsMobile();
 const [searchParams, setSearchParams] = useSearchParams();
 const qc = useQueryClient();

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
 const endRef = useRef(null);
 const textareaRef = useRef(null);
 const localIdCounter = useRef(0);

 // Sources rail state
 const [sourcesRailOpen, setSourcesRailOpen] = useState(!isMobile);
 const [activeSourceRank, setActiveSourceRank] = useState(null);
 const [openedResourceId, setOpenedResourceId] = useState(null);
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

 // Scroll to bottom on new messages
 useEffect(() => {
 endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
 }, [messages, loading]);

 // Deep-link session via ?session=
 useEffect(() => {
 const sid = searchParams.get('session');
 if (sid && !sessionId && sessions.length) {
 const existing = sessions.find((s) => s.id === sid);
 if (existing) openSession(existing);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [sessions.length, searchParams]);

 // Auto-grow textarea
 useEffect(() => {
 const ta = textareaRef.current;
 if (!ta) return;
 ta.style.height = 'auto';
 ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
 }, [input]);

 const openSession = useCallback(async (s) => {
 if (activeStream.current) { activeStream.current.abort(); activeStream.current = null; }
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
 }, [isMobile, setSearchParams]);

 const startNewChat = useCallback(() => {
 if (activeStream.current) { activeStream.current.abort(); activeStream.current = null; }
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

 const regenerate = async () => {
 // Find the last user message and resend its text without attachments.
 let lastUser = null;
 for (let i = messages.length - 1; i >= 0; i--) {
 if (messages[i].role === 'user') { lastUser = messages[i]; break; }
 }
 if (!lastUser || loading) return;
 setInput(lastUser.content);
 // Remove the last assistant message + resend
 setMessages((prev) => {
 const out = [...prev];
 for (let i = out.length - 1; i >= 0; i--) {
 if (out[i].role === 'assistant') { out.splice(i, 1); break; }
 }
 return out;
 });
 setTimeout(() => send(lastUser.content), 0);
 };

 const send = async (textOverride) => {
 const content = (textOverride ?? input).trim();
 if ((!content && attachedResources.length === 0) || loading) return;
 setError('');
 setLoading(true);
 const localId = `local-${++localIdCounter.current}`;
 const assistantLocalId = `asst-${++localIdCounter.current}`;
 const attachments = attachedResources.map((r) => ({ id: r.id, title: r.title, mime_type: r.mime_type, size: r.size }));
 const resourceIds = attachedResources.map((r) => r.id).filter(Boolean);
 const userContent = content || `Tell me about ${attachments.map((a) => `"${a.title}"`).join(', ')}.`;
 pushMessage({ id: localId, role: 'user', content: userContent, attachments, created_at: new Date().toISOString() });
 setInput('');
 setAttachedResources([]);
 setPickerOpen(false);
 setActiveSourceRank(null);

 try {
 const sid = await ensureSession();
 pushMessage({ id: assistantLocalId, role: 'assistant', content: '', streaming: true, sources: [], created_at: new Date().toISOString() });
 let fullContent = '';
 let currentSources = [];

 const ctrl = chatApi.stream(sid, userContent, {
 resourceIds,
 onMeta: (meta) => {
 if (meta?.user_message) {
 setMessages((prev) => prev.map((m) => (m.id === localId ? meta.user_message : m)));
 }
 if (!sessionTitle || sessionTitle === 'New chat') {
 setSessionTitle(userContent.slice(0, 60));
 }
 },
 onToken: (tok) => {
 fullContent += tok;
 setMessages((prev) => prev.map((m) => (m.id === assistantLocalId ? { ...m, content: fullContent } : m)));
 },
 onDone: (assistantMsg) => {
 if (assistantMsg?.sources) currentSources = assistantMsg.sources;
 setMessages((prev) => prev.map((m) => (m.id === assistantLocalId ? { ...assistantMsg, streaming: false } : m)));
 setSessionTitle((t) => t || userContent.slice(0, 60));
 qc.invalidateQueries({ queryKey: ['chat-sessions'] });
 activeStream.current = null;
 setLoading(false);
 if (currentSources.length > 0 && !isMobile) setSourcesRailOpen(true);
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
 className="h-8 w-full gap-1.5 bg-[var(--accent)] text-xs text-white hover:bg-[var(--accent-strong)]"
 >
 <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
 New chat
 </Button>
 </div>
 <div className="border-b px-3 py-2">
 <div className="relative">
 <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
 <input
 value={historyQuery}
 onChange={(e) => setHistoryQuery(e.target.value)}
 placeholder="Search history…"
 className="h-7 w-full rounded-md border bg-background pl-7 pr-2 text-[11px] focus-visible:outline-2 focus-visible:outline-ring"
 />
 </div>
 </div>
 <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
 Recent
 </p>
 <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
 {sessionsQ.isLoading ? (
 <p className="px-2 py-3 text-[11px] text-sidebar-muted">Loading…</p>
 ) : filteredHistory.length === 0 ? (
 <p className="px-2 py-3 text-[11px] text-sidebar-muted">
 {historyQuery ? 'No matches.' : 'Your conversations will appear here.'}
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
  window.dispatchEvent(new CustomEvent('academiai:open-mobile-menu'))
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
 <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={renameSession}>Save</Button>
 <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingTitle(false)}>
 <X className="h-3.5 w-3.5" />
 </Button>
 </div>
 ) : (
 <>
 <h2 className="truncate text-sm font-semibold">{sessionTitle}</h2>
 <button
 type="button"
 onClick={() => { setTitleDraft(sessionTitle); setEditingTitle(true); }}
 className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
 aria-label="Rename"
 >
 <Pencil className="h-3 w-3" />
 </button>
 </>
 )
 ) : (
 <h2 className="text-sm font-semibold">
 <span className="ai-text">AcademiAI</span> Chat
 </h2>
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
 {sourcesRailOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
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
 <div className="flex-1 overflow-y-auto">
 {messages.length === 0 ? (
 <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center sm:p-8">
 {/* Empty hero */}
 <div className="flex flex-col items-center gap-3">
 <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-primary">
 <Sparkles className="h-7 w-7" aria-hidden />
 </span>
 <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
 What can I help you <span className="ai-text">study</span> today?
 </h1>
 <p className="max-w-md text-sm text-muted-foreground">
 Ask questions about your authorized materials. Responses stream in real time with
 numbered citations that open the source document directly.
 </p>
 </div>
 <div className="grid w-full gap-2.5 sm:grid-cols-2">
 {SUGGESTIONS.map((s) => {
 const Icon = s.icon;
 return (
 <button
 key={s.title}
 type="button"
 onClick={() => { setInput(s.prompt); setTimeout(() => send(s.prompt), 0); }}
 disabled={loading}
 className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-all transition-colors hover:border-[var(--border-strong)] "
 >
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
 <Icon className="h-4 w-4" aria-hidden />
 </span>
 <span className="min-w-0">
 <span className="block text-[13px] font-semibold">{s.title}</span>
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
 <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6" role="log" aria-live="polite">
 {messages.map((msg, idx) => (
 <MessageBubble
 key={msg.id}
 msg={msg}
 isLastAssistant={msg.role === 'assistant' && idx === messages.length - 1 && !loading}
 onSourceClick={(rank) => {
 setActiveSourceRank(rank);
 if (!sourcesRailOpen) setSourcesRailOpen(true);
 }}
 onOpenSourceResource={openSourceResource}
 onRegenerate={regenerate}
 />
 ))}
 <div ref={endRef} />
 </div>
 )}
 </div>

 {/* Sources rail */}
 {sourcesRailOpen && currentSources.length > 0 && (
 <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l bg-card/40 p-3.5 md:flex">
 <div className="mb-2.5 flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden />
 <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</h3>
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
 {currentSources.length} document{currentSources.length === 1 ? '' : 's'} used to ground this answer. Click a numbered citation in the response to highlight its source.
 </p>
 <div className="space-y-1.5">
 {currentSources.map((s) => (
 <SourceCard
 key={s.chunk_id || s.id || s.rank}
 source={s}
 active={activeSourceRank === s.rank}
 onClick={() => setActiveSourceRank((r) => (r === s.rank ? null : s.rank))}
 onOpenResource={openSourceResource}
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
 <AlertDescription className="text-xs">{error}</AlertDescription>
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
 onRemove={loading ? undefined : () => removeAttachedResource(r.id)}
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
 <TooltipContent side="top">Attach from library</TooltipContent>
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
 className="max-h-48 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
 />
 <Tooltip>
 <TooltipTrigger asChild>
 <Button
 type="submit"
 size="icon"
 disabled={loading ? false : (!input.trim() && attachedResources.length === 0) || uploadingFiles}
 aria-label={loading ? 'Stop generating' : 'Send message'}
 className={cn(
 'h-9 w-9 shrink-0 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]',
 loading && 'bg-destructive hover:bg-destructive/90',
 )}
 >
 {loading ? <Square className="h-[16px] w-[16px] fill-current" aria-hidden /> : <ArrowUp className="h-[18px] w-[18px]" aria-hidden />}
 </Button>
 </TooltipTrigger>
 <TooltipContent side="top">{loading ? 'Stop' : 'Send'}</TooltipContent>
 </Tooltip>
 </div>
 <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-muted-foreground">
   <span>
     Answers are grounded in your authorised materials.
     <span className="ml-1 rounded-md bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</span>
     <span className="mx-0.5">to send ·</span>
     <span className="rounded-md bg-muted px-1 py-0.5 font-mono text-[10px]">Shift+Enter</span>
     <span className="ml-0.5">newline</span>
   </span>
   <span className="hidden sm:inline">AI can make mistakes — verify with sources.</span>
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
  <ConfirmDialog
  open={!!sessionToDelete}
  title="Delete conversation?"
  description={`"${sessionToDelete?.title || 'Untitled chat'}" will be permanently deleted. This cannot be undone.`}
  onCancel={() => setSessionToDelete(null)}
  onConfirm={() => { const s = sessionToDelete; setSessionToDelete(null); deleteSession(s); }}
  confirmLabel="Delete"
  destructive
  />
  </AppShell>
  </TooltipProvider>
  );
}
