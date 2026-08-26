import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import api, { dashApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { FileText, Plus, Upload as UploadIcon, Search } from 'lucide-react';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import { resourceSchema } from '@/lib/validations';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const SCOPES = [
  'private',
  'course',
  'programme',
  'department',
  'faculty',
  'institution',
];

export default function ResourcesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data, isLoading, loadError, refetch } = useQuery({
    queryKey: ['resources', user?.role],
    queryFn: async () => {
      // Students/lecturers only see what their academic scope allows
      // (department, faculty, programme, enrolled courses); staff sees the
      // whole tenant for management purposes.
      const scoped =
        user?.role === 'student' || user?.role === 'lecturer'
          ? { params: { scope: 'authorized' } }
          : {};
      return await dashApi.resources(scoped);
    },
    refetchInterval: (query) => {
      // Poll lightly while any material is still processing.
      const list = query.state.data || [];
      const busy = list.some(
        (r) =>
          r.processing_status === 'pending' ||
          r.processing_status === 'processing',
      );
      return busy ? 8000 : false;
    },
  });

  const resources = data || [];

  const form = useForm({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: '',
      description: '',
      visibility_scope: 'course',
      course_offering: '',
    },
  });

  const chosenScope = form.watch('visibility_scope');

  // Offerings for the course-scoped visibility selector — a course material
  // without an offering would be undiscoverable.
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
      setOpen(false);
      form.reset({
        title: '',
        description: '',
        visibility_scope: 'course',
        course_offering: '',
      });
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['dash-resources'] });
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || 'Create failed');
      toast.error('Create failed');
    },
  });

  const onSubmit = (values) => {
    setError('');
    const payload = { ...values };
    if (!payload.course_offering) delete payload.course_offering;
    createMut.mutate(payload);
  };

  const filtered = useMemo(() => {
    let list = resources;
    if (scopeFilter !== 'all') {
      list = list.filter((r) => r.visibility_scope === scopeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [resources, search, scopeFilter]);

  return (
    <AppShell
      title="Resources"
      description="Academic materials with scoped visibility private, course, programme, department, faculty or institution-wide."
      actions={
        <>
          <Link
            to="/resources/upload"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none"
          >
            <UploadIcon aria-hidden /> Upload material
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none">
              <Plus aria-hidden /> New resource
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create resource metadata</DialogTitle>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-3.5"
                >
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
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
                        <FormLabel>Visibility scope</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v !== 'course')
                              form.setValue('course_offering', '');
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full capitalize">
                              <SelectValue placeholder="Scope" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SCOPES.map((s) => (
                              <SelectItem
                                key={s}
                                value={s}
                                className="capitalize"
                              >
                                {s}
                              </SelectItem>
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
                          <FormLabel>Course offering</FormLabel>
                          <Select
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
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
                                <SelectItem key={o.id} value={o.id}>
                                  {o.course_code
                                    ? `${o.course_code} — ${o.course_title || ''}`
                                    : o.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Students enrolled in this offering will see the
                            material.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createMut.isPending}>
                      {createMut.isPending ? 'Saving' : 'Create resource'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-55 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description"
            aria-label="Search resources"
            className="h-10 pl-9"
          />
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by visibility"
        >
          {['all', ...SCOPES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScopeFilter(s)}
              aria-pressed={scopeFilter === s}
              className={cn(
                'h-9 rounded-lg border px-3 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                scopeFilter === s
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <span className="font-medium">Could not load materials.</span>{' '}
            {String(
              loadError?.response?.data?.detail ||
                loadError.message ||
                loadError,
            )}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : isLoading ? (
        <SkeletonRows rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            search || scopeFilter !== 'all'
              ? 'No matching resources'
              : 'No resources yet'
          }
          description={
            search || scopeFilter !== 'all'
              ? 'Try a different search term or clear the visibility filter.'
              : 'Upload your first material it will be extracted, chunked and made searchable automatically.'
          }
          action={
            !search && scopeFilter === 'all' ? 'Upload material' : undefined
          }
          actionTo={
            !search && scopeFilter === 'all' ? '/resources/upload' : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <article
                role="button"
                tabIndex={0}
                onClick={() => setSelected(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(r);
                  }
                }}
                className="group flex h-full cursor-pointer flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="truncate text-sm font-semibold leading-snug"
                      title={r.title}
                    >
                      {r.title}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {r.description || 'No description'}
                    </p>
                  </div>
                </div>
                {r.processing_status === 'failed' && r.processing_error ? (
                  <p className="mt-2 line-clamp-2 rounded-md bg-red-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-red-700 dark:text-red-400">
                    {r.processing_error}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3.5">
                  <StatusBadge status={r.processing_status} />
                  <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {r.visibility_scope}
                  </span>
                  {r.processing_status === 'ready' ? (
                    <span className="ml-auto text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open
                    </span>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <ResourceDetailDialog
        resource={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </AppShell>
  );
}
