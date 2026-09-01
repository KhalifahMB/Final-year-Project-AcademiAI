import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import StatusBadge from '@/components/shared/StatusBadge';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from '@/components/ui/dialog';
import {
 Form,
 FormControl,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
} from '@/components/ui/form';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
 Filter,
 Grid3x3,
 LayoutList,
 Plus,
 Search,
 SlidersHorizontal,
 Sparkles,
 Upload as UploadIcon,
 X,
} from 'lucide-react';
import { resourceSchema } from '@/lib/validations';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getFileType, SCOPE_META } from '@/lib/filetypes';

const SCOPES = ['private', 'course', 'programme', 'department', 'faculty', 'institution'];

const PAGE_SIZE = 12;

const STATUS_FILTERS = [
 { value: 'all', label: 'All status' },
 { value: 'ready', label: 'Ready' },
 { value: 'processing', label: 'Processing' },
 { value: 'pending', label: 'Queued' },
 { value: 'failed', label: 'Failed' },
];

const SORT_OPTIONS = [
 { value: 'newest', label: 'Newest first' },
 { value: 'oldest', label: 'Oldest first' },
 { value: 'alpha', label: 'A → Z' },
];

const VIEWS = [
 { value: 'grid', icon: Grid3x3, label: 'Grid' },
 { value: 'list', icon: LayoutList, label: 'List' },
];

export default function ResourcesPage() {
 const { user } = useAuth();
 const qc = useQueryClient();

 // Dialog / selection
 const [createOpen, setCreateOpen] = useState(false);
 const [createError, setCreateError] = useState('');
 const [selected, setSelected] = useState(null);

 // Filters
 const [searchParams] = useSearchParams();
 const [search, setSearch] = useState(searchParams.get('q') ?? '');
 const [scopeFilter, setScopeFilter] = useState('all');
 const [statusFilter, setStatusFilter] = useState('all');
 const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

 const { data, isLoading, error: loadError, refetch } = useQuery({
 queryKey: ['resources', user?.role],
 queryFn: async () => {
 const params =
 user?.role === 'student' || user?.role === 'lecturer'
 ? { scope: 'authorized' }
 : {};
 const { data: resp } = await api.get('/resources/', { params });
 return Array.isArray(resp) ? resp : resp?.results || [];
 },
 refetchInterval: (query) => {
 const list = query.state.data || [];
 const busy = list.some(
 (r) => r.processing_status === 'pending' || r.processing_status === 'processing',
 );
 return busy ? 8000 : false;
 },
 });

 const resources = useMemo(() => data || [], [data]);

 const form = useForm({
 resolver: zodResolver(resourceSchema),
 defaultValues: {
 title: '',
 description: '',
 visibility_scope: 'course',
 course_offering: '',
 },
 });
 const chosenScope = useWatch({ control: form.control, name: 'visibility_scope' });

 const offerings = useQuery({
 queryKey: ['offerings-for-resource'],
 queryFn: async () => {
 const { data } = await api.get('/course-offerings/?page_size=200');
 return data.results || data;
 },
 enabled: chosenScope === 'course',
 staleTime: 60_000,
 });

 const createMut = useMutation({
 mutationFn: (payload) => api.post('/resources/', payload),
 onSuccess: () => {
 toast.success('Resource created');
 setCreateOpen(false);
 form.reset({ title: '', description: '', visibility_scope: 'course', course_offering: '' });
 qc.invalidateQueries({ queryKey: ['resources'] });
 qc.invalidateQueries({ queryKey: ['dash-resources'] });
 },
 onError: (err) => {
 setCreateError(err.response?.data?.error?.detail || 'Create failed');
 toast.error('Create failed');
 },
 });

 const onSubmit = (values) => {
 setCreateError('');
 const payload = { ...values };
 if (!payload.course_offering) delete payload.course_offering;
 createMut.mutate(payload);
 };

 const filtered = useMemo(() => {
 let list = [...resources];

 if (scopeFilter !== 'all') {
 list = list.filter((r) => r.visibility_scope === scopeFilter);
 }
 if (statusFilter !== 'all') {
 list = list.filter((r) => r.processing_status === statusFilter);
 }
 if (search.trim()) {
 const q = search.trim().toLowerCase();
 list = list.filter(
 (r) =>
 r.title?.toLowerCase().includes(q) ||
 r.description?.toLowerCase().includes(q),
 );
 }

 switch (sort) {
 case 'oldest':
 list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
 break;
 case 'alpha':
 list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
 break;
 case 'newest':
 default:
 list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
 }

 return list;
 }, [resources, scopeFilter, statusFilter, search, sort]);

 // Counts for active filter chips
 const counts = useMemo(() => {
 const c = { all: resources.length, ready: 0, processing: 0, pending: 0, failed: 0 };
 for (const r of resources) {
 const s = r.processing_status;
 if (s in c) c[s] += 1;
 }
 return c;
 }, [resources]);

  const hasActiveFilters = scopeFilter !== 'all' || statusFilter !== 'all' || sort !== 'newest';
  const resetFilters = () => {
  setScopeFilter('all');
  setStatusFilter('all');
  setSort('newest');
  setSearch('');
  setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

 // Sub-component for a list-item row (alternative to the grid cards)
 const ResourceRow = ({ r }) => (
 <div
 role="button"
 tabIndex={0}
 onClick={() => setSelected(r)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(r); }
 }}
 className={cn(
 'group flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5',
 'transition-all hover:border-primary/40 hover:bg-accent/30',
 'focus-visible:outline-2 focus-visible:outline-ring',
 )}
 >
 <ResourceCardCompact resource={r} />
 </div>
 );

 return (
 <AppShell
 title="Resources"
 description="Upload, browse, and search academic materials. Every document is chunked, indexed, and citable by the AI assistant."
 actions={
 <div className="flex items-center gap-2">
 <Link
 to="/resources/upload"
 className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
 >
 <UploadIcon className="h-3.5 w-3.5" aria-hidden /> Upload
 </Link>
 <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateError(''); }}>
 <DialogTrigger asChild>
 <Button size="sm" className="h-8 gap-1.5 px-3 text-xs">
 <Plus className="h-3.5 w-3.5" aria-hidden /> New resource
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="text-sm">Create resource metadata</DialogTitle>
 </DialogHeader>
 {createError && (
 <Alert variant="destructive">
 <AlertDescription>{String(createError)}</AlertDescription>
 </Alert>
 )}
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
 <FormField
 control={form.control}
 name="title"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Title</FormLabel>
 <FormControl>
 <Input {...field} className="h-9" placeholder="e.g. CSC401 Week 3 Lecture Notes" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="description"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Description</FormLabel>
 <FormControl>
 <Textarea rows={2} {...field} className="min-h-[60px] text-sm" placeholder="What is this material about?" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="visibility_scope"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Visibility scope</FormLabel>
 <Select
 value={field.value}
 onValueChange={(v) => {
 field.onChange(v);
 if (v !== 'course') form.setValue('course_offering', '');
 }}
 >
 <FormControl>
 <SelectTrigger className="h-9 w-full capitalize text-sm">
 <SelectValue placeholder="Scope" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {SCOPES.map((s) => (
 <SelectItem key={s} value={s} className="capitalize text-sm">{s}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 {chosenScope === 'course' && (
 <FormField
 control={form.control}
 name="course_offering"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Course offering</FormLabel>
 <Select value={field.value || undefined} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger className="h-9 w-full text-sm">
 <SelectValue
 placeholder={
 offerings.isLoading
 ? 'Loading offerings…'
 : (offerings.data || []).length === 0
 ? 'No offerings available'
 : 'Select offering'
 }
 />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {(offerings.data || []).map((o) => (
 <SelectItem key={o.id} value={o.id} className="text-sm">
 {o.course_code ? `${o.course_code} — ${o.course_title || ''}` : o.id}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-[11px] leading-snug text-muted-foreground">
 Students enrolled in this offering will see the material.
 </p>
 <FormMessage />
 </FormItem>
 )}
 />
 )}
 <DialogFooter className="pt-1">
 <Button type="submit" size="sm" disabled={createMut.isPending} className="h-8">
 {createMut.isPending ? 'Saving…' : 'Create resource'}
 </Button>
 </DialogFooter>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>
 }
 >
 {/* Stats strip */}
 <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
 <StatTile label="Total materials" value={counts.all} />
 <StatTile label="Ready" value={counts.ready} tone="emerald" icon={Sparkles} />
 <StatTile label="Processing" value={counts.processing + counts.pending} tone="sky" />
 <StatTile label="Failed" value={counts.failed} tone="red" />
 </div>

 {/* Toolbar */}
 <div className="mb-3 flex flex-wrap items-center gap-2">
 <div className="relative min-w-[220px] flex-1">
 <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
 <Input
 value={search}
 onChange={(e) => { setSearch(e.target.value); setPage(1); }}
 placeholder="Search by title or description…"
 aria-label="Search resources"
 className="h-9 pl-8 text-sm"
 />
 {search && (
 <button
 type="button"
 onClick={() => { setSearch(''); setPage(1); }}
 className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
 aria-label="Clear search"
 >
 <X className="h-3.5 w-3.5" />
 </button>
 )}
 </div>

 {/* Scope chips (compact, primary filter) */}
 <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by scope">
 <ScopeChip active={scopeFilter === 'all'} onClick={() => { setScopeFilter('all'); setPage(1); }} label="All" />
 {SCOPES.map((s) => (
 <ScopeChip
 key={s}
 active={scopeFilter === s}
 onClick={() => { setScopeFilter(s); setPage(1); }}
 label={SCOPE_META[s].label}
 />
 ))}
 </div>

 {/* More filters toggle */}
 <Button
 variant={filtersOpen || hasActiveFilters ? 'secondary' : 'outline'}
 size="sm"
 className={cn('h-9 gap-1.5 px-2.5 text-xs', hasActiveFilters && !filtersOpen && 'border-primary/30 bg-primary/5 text-primary')}
 onClick={() => setFiltersOpen((v) => !v)}
 >
 <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
 Filters
 {hasActiveFilters && <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">•</span>}
 </Button>

 {/* Sort */}
 <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
 <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Sort">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {SORT_OPTIONS.map((o) => (
 <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* View toggle */}
 <div
 className="inline-flex h-9 items-center rounded-lg border p-0.5"
 role="group"
 aria-label="View mode"
 >
 {VIEWS.map((v) => {
 const Icon = v.icon;
 const active = view === v.value;
 return (
 <button
 key={v.value}
 type="button"
 onClick={() => setView(v.value)}
 aria-pressed={active}
 title={v.label}
 className={cn(
 'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
 active ? 'bg-accent text-foreground' : 'hover:bg-muted hover:text-foreground',
 )}
 >
 <Icon className="h-3.5 w-3.5" aria-hidden />
 </button>
 );
 })}
 </div>
 </div>

 {/* Secondary filters panel */}
 {filtersOpen && (
 <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border bg-card/60 p-3.5">
 <div className="min-w-[180px] flex-1">
 <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
 Status
 </label>
 <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
 <SelectTrigger className="h-9 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {STATUS_FILTERS.map((f) => (
 <SelectItem key={f.value} value={f.value} className="text-xs">
 {f.label} {f.value !== 'all' && `(${counts[f.value] || 0})`}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 text-xs text-muted-foreground">
 <Filter className="mr-1.5 h-3 w-3" /> Reset filters
 </Button>
 </div>
 )}

 {/* Active filter chips */}
 {hasActiveFilters && (
 <div className="mb-3 flex flex-wrap items-center gap-1.5">
 {statusFilter !== 'all' && (
 <FilterChip label={`Status: ${STATUS_FILTERS.find((s) => s.value === statusFilter)?.label || statusFilter}`} onClear={() => { setStatusFilter('all'); setPage(1); }} />
 )}
 {sort !== 'newest' && (
 <FilterChip label={`Sort: ${SORT_OPTIONS.find((s) => s.value === sort)?.label || sort}`} onClear={() => { setSort('newest'); setPage(1); }} />
 )}
 </div>
 )}

 {/* Content */}
 {loadError ? (
 <Alert variant="destructive" className="mb-4">
 <AlertDescription>
 <span className="font-medium">Could not load materials.</span>{' '}
 {String(loadError?.response?.data?.detail || loadError?.message || loadError)}
 </AlertDescription>
 <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
 Retry
 </Button>
 </Alert>
 ) : isLoading ? (
 view === 'grid' ? (
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {Array.from({ length: 6 }).map((_, i) => (
 <div
 key={i}
 className="skeleton h-[150px] rounded-xl"
 style={{ animationDelay: `${i * 70}ms` }}
 />
 ))}
 </div>
 ) : (
 <div className="space-y-2">
 {Array.from({ length: 6 }).map((_, i) => (
 <div
 key={i}
 className="skeleton h-[56px] rounded-lg"
 style={{ animationDelay: `${i * 60}ms` }}
 />
 ))}
 </div>
 )
 ) : filtered.length === 0 ? (
 <EmptyState
 icon={Sparkles}
 title={search || hasActiveFilters ? 'No matching materials' : 'No resources yet'}
 description={
 search || hasActiveFilters
 ? 'Try a different search term or clear your filters.'
 : 'Upload your first document — it will be extracted, chunked and made citable by the AI.'
 }
 action={!search && !hasActiveFilters ? 'Upload material' : undefined}
 actionTo={!search && !hasActiveFilters ? '/resources/upload' : undefined}
 />
 ) : view === 'grid' ? (
 <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {paged.map((r) => (
 <li key={r.id}>
 <ResourceCard
 resource={r}
 onOpen={setSelected}
 onDeleted={() => qc.invalidateQueries({ queryKey: ['resources'] })}
 />
 </li>
 ))}
 </ul>
 ) : (
 <ul className="space-y-1.5">
 {paged.map((r) => (
 <li key={r.id}><ResourceRow r={r} /></li>
 ))}
 </ul>
 )}

 {filtered.length > PAGE_SIZE && (
 <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
 )}

 <ResourceDetailDialog
 resource={selected}
 open={!!selected}
 onClose={() => setSelected(null)}
 />
 </AppShell>
 );
}

/* ------- Small internal pieces ------- */

function StatTile({ label, value, tone = 'indigo', icon: Icon }) {
 const tones = {
 indigo: 'text-primary',
 emerald: 'text-[var(--success)] ',
 sky: 'text-[var(--info)] ',
 red: 'text-[var(--danger)]',
 };
 return (
 <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
 {Icon && (
 <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted', tones[tone])}>
 <Icon className="h-4 w-4" aria-hidden />
 </span>
 )}
 <div className="min-w-0">
 <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
 <p className={cn('text-xl font-semibold tabular-nums tracking-tight', tones[tone])}>{value ?? 0}</p>
 </div>
 </div>
 );
}

function ScopeChip({ active, onClick, label }) {
 return (
 <button
 type="button"
 onClick={onClick}
 aria-pressed={active}
 className={cn(
 'h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-ring',
 active
 ? 'bg-primary/10 text-primary'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground',
 )}
 >
 {label}
 </button>
 );
}

function FilterChip({ label, onClear }) {
 return (
 <span className="inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2.5 text-[11px] font-medium text-muted-foreground">
 {label}
 <button
 type="button"
 onClick={onClear}
 className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
 aria-label={`Remove filter ${label}`}
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 );
}

/**
 * Compact single-line row for list view (used internally by ResourcesPage).
 * Not exported; the card variant is the public, reusable ResourceCard.
 */
function ResourceCardCompact({ resource }) {
 const ft = getFileType(resource?.title || '', resource?.mime_type);
 const FileIcon = ft.icon;
 const scope = SCOPE_META[resource?.visibility_scope] || SCOPE_META.private;
 return (
 <>
 <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ft.tint)}>
 <FileIcon className="h-4 w-4" aria-hidden />
 </span>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium">{resource.title}</p>
 <p className="truncate text-[11px] text-muted-foreground">
 {resource.description || ft.label}
 </p>
 </div>
 <div className="flex shrink-0 items-center gap-1.5">
 <StatusBadge status={resource.processing_status} />
 <span className={cn('hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex', scope.tint)}>
 {scope.label}
 </span>
 </div>
 </>
 );
}
