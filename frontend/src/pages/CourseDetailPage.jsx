import { useParams, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import ResourceCard from '@/components/resources/ResourceCard';
import ResourceDetailDialog from '@/components/resources/ResourceDetailDialog';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/filetypes';
import { useAuth } from '@/hooks/useAuth';
import {
 UserRound,
 Mail,
 ArrowLeft,
 BookOpen,
 CalendarDays,
 Clock,
 FileText,
 GraduationCap,
 Loader2,
 Upload,
 UploadCloud,
 X,
} from 'lucide-react';

const UPLOAD_ACCEPT = '.txt,.md,.pdf,.docx,.pptx,.json,.csv,.xlsx,.ppt,.doc,.xls';
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_MAX_FILES = 20;

export default function CourseDetailPage() {
 const { id } = useParams();
 const { user } = useAuth();
 const qc = useQueryClient();
 const role = user?.role;
 const fileInputRef = useRef(null);

 const [uploadOpen, setUploadOpen] = useState(false);
 const [selected, setSelected] = useState(null);
 const [files, setFiles] = useState([]);
 const [uploadError, setUploadError] = useState('');
 const [uploading, setUploading] = useState(false);
 const [progress, setProgress] = useState({ done: 0, total: 0, name: '' });
 const [isDragging, setIsDragging] = useState(false);

 const addFiles = (list) => {
  setUploadError('');
  const next = [];
  for (const f of list) {
  if (!f) continue;
  if (f.size > UPLOAD_MAX_BYTES) {
  setUploadError(`“${f.name}” exceeds the 25 MB limit (${formatBytes(f.size)}).`);
  continue;
  }
  if (files.length + next.length >= UPLOAD_MAX_FILES) {
  setUploadError(`You can upload up to ${UPLOAD_MAX_FILES} files at once.`);
  break;
  }
  next.push(f);
  }
  if (next.length) setFiles((prev) => [...prev, ...next]);
 };

 const uploadAll = useMutation({
  mutationFn: async (fileList) => {
  const departmentId = offering.data?.department;
  const total = fileList.length;
  for (let i = 0; i < total; i++) {
  const f = fileList[i];
  setProgress({ done: i, total, name: f.name });
  const payload = {
  title: f.name.replace(/\.[^.]+$/, ''),
  description: '',
  visibility_scope: 'department',
  course_offering: id,
  };
  if (departmentId) payload.department = departmentId;
  const { data: resource } = await api.post('/resources/', payload);

  const contentType = f.type || 'application/octet-stream';
  const { data: presign } = await api.post(
  `/resources/${resource.id}/request_upload_url/`,
  { content_type: contentType },
  );

  const form = new FormData();
  Object.entries(presign.form_fields || {}).forEach(([k, v]) => form.append(k, v));
  form.append('file', f);
  const put = await fetch(presign.upload_url, { method: 'POST', body: form });
  if (!put.ok) {
  throw new Error(`Storage rejected “${f.name}”. Check the file size/type and retry.`);
  }

  await api.post(
  `/resources/${resource.id}/complete_upload/`,
  { storage_key: presign.storage_key },
  );
  }
  setProgress({ done: total, total, name: '' });
  return { count: fileList.length };
  },
  onSuccess: ({ count }) => {
  toast.success(`${count} material${count === 1 ? '' : 's'} uploaded — indexing started`);
  setUploadOpen(false);
  setFiles([]);
  setUploadError('');
  qc.invalidateQueries({ queryKey: ['resources', 'offering', id] });
  qc.invalidateQueries({ queryKey: ['resources'] });
  },
  onError: (e) => {
  setUploadError(e.response?.data?.error?.detail || e.message || 'Upload failed');
  },
  onSettled: () => setUploading(false),
 });

 const submitUpload = (e) => {
  e.preventDefault();
  if (!files.length) return;
  setUploadError('');
  setUploading(true);
  uploadAll.mutate(files);
 };

 const offering = useQuery({
  queryKey: ['course-offering', id],
  queryFn: async () => (await api.get(`/course-offerings/${id}/`)).data,
  enabled: !!id,
 });

 const course = useQuery({
  queryKey: ['course', offering.data?.course],
  queryFn: async () => (await api.get(`/courses/${offering.data.course}/`)).data,
  enabled: !!offering.data?.course,
 });

 const resources = useQuery({
  queryKey: ['resources', 'offering', id],
  queryFn: async () => {
  const params = { course_offering: id };
  if (role === 'student' || role === 'lecturer') params.scope = 'authorized';
  const { data } = await api.get('/resources/', { params });
  return data.results || data;
  },
  enabled: !!id,
 });

 const canManage = offering.data?.can_manage_materials === true;
 const departmentName = offering.data?.department_name;

 const dropHandlers = {
  onDragOver: (e) => { e.preventDefault(); setIsDragging(true); },
  onDragLeave: () => setIsDragging(false),
  onDrop: (e) => {
  e.preventDefault();
  setIsDragging(false);
  addFiles(e.dataTransfer.files);
  },
 };

 if (offering.error) {
 return (
 <AppShell title="Course details">
 <Alert variant="destructive" className="mb-4 mt-6">
 <AlertDescription className="text-xs">Offering not found or unauthorized</AlertDescription>
 </Alert>
 </AppShell>
 );
 }

 const isLoading = offering.isLoading || course.isLoading;
 const code = offering.data?.course_code || course.data?.code || '—';
 const title = offering.data?.course_title || course.data?.title || 'Course Offering';

 return (
 <AppShell title={title} description="Detailed information and resources for this course offering.">
 <Link
 to="/my-courses"
 className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
 >
 <ArrowLeft className="h-3.5 w-3.5" />
 Back to my courses
 </Link>

 {isLoading ? (
 <div className="space-y-4">
 <div className="skeleton h-[140px] rounded-2xl" />
 <div className="grid gap-4 md:grid-cols-2">
 <div className="skeleton h-[160px] rounded-xl" />
 <div className="skeleton h-[160px] rounded-xl" />
 </div>
 </div>
 ) : (
 <div className="space-y-5">
 {/* Hero */}
 <div className="relative overflow-hidden rounded-2xl border bg-[var(--accent-soft)] p-6 sm:p-8">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
 <div className="space-y-3 max-w-2xl">
 <div className="flex flex-wrap items-center gap-2">
 <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-primary">
 {code}
 </span>
 <StatusBadge status={offering.data?.status || 'unknown'} />
 </div>
 <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
 {offering.data?.session_name && (
 <span className="inline-flex items-center gap-1">
 <CalendarDays className="h-3 w-3" aria-hidden /> {offering.data.session_name}
 </span>
 )}
 {offering.data?.semester_name && (
 <span className="inline-flex items-center gap-1">
 <Clock className="h-3 w-3" aria-hidden /> {offering.data.semester_name}
 </span>
 )}
 {course.data?.credit_unit != null && (
 <span className="inline-flex items-center gap-1">
 <BookOpen className="h-3 w-3" aria-hidden /> {course.data.credit_unit} credits
 </span>
 )}
 </div>
 </div>
 <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--on-accent)] sm:flex">
 <GraduationCap className="h-8 w-8" aria-hidden />
 </span>
 </div>
 </div>

 {/* Info grid */}
 <div className="grid gap-4 md:grid-cols-2">
 <InfoCard title="Course description" icon={BookOpen}>
 <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
 {course.data?.description || 'No description provided for this course.'}
 </p>
 </InfoCard>
 <InfoCard title="Offering details" icon={CalendarDays}>
 <dl className="divide-y text-[13px]">
 <DetailRow label="Status" value={<span className="capitalize">{offering.data?.status || '—'}</span>} />
 <DetailRow label="Session" value={offering.data?.session_name || '—'} />
 <DetailRow label="Semester" value={offering.data?.semester_name || '—'} />
 <DetailRow label="Code" value={<code className="font-mono text-xs">{code}</code>} />
 </dl>
</InfoCard>
  </div>

  {/* Teaching team */}
  <div className="rounded-xl border bg-card p-4">
  <div className="mb-3 flex items-center gap-2">
  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
  <UserRound className="h-3.5 w-3.5" aria-hidden />
  </span>
  <h3 className="text-xs font-semibold uppercase tracking-wider">Teaching team</h3>
  </div>
  {(offering.data?.lecturers || []).length === 0 ? (
  <p className="text-[13px] text-muted-foreground">No lecturers assigned to this offering yet.</p>
  ) : (
  <ul className="grid gap-2 sm:grid-cols-2">
  {(offering.data.lecturers || []).map((l) => (
  <li key={l.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--info-soft)] text-[var(--info)]">
  <UserRound className="h-4 w-4" aria-hidden />
  </span>
  <div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium capitalize">{l.name}</p>
  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
  <Mail className="h-3 w-3 shrink-0" aria-hidden /> {l.email}
  </p>
  </div>
  {l.role === 'coordinator' ? (
  <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium capitalize text-amber-700 dark:text-amber-300">
  Coordinator
  </span>
  ) : null}
  </li>
  ))}
  </ul>
  )}
  </div>

{/* Resources */}
  <div>
  <div className="mb-3 flex items-center justify-between">
  <h2 className="text-sm font-semibold tracking-tight">Course materials</h2>
  <div className="flex items-center gap-2">
  {canManage && (
  <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) { setFiles([]); setUploadError(''); setProgress({ done: 0, total: 0, name: '' }); } }}>
  <DialogTrigger asChild>
  <Button size="sm" className="h-7 gap-1.5 px-2.5 text-[11px]">
  <Upload className="h-3.5 w-3.5" aria-hidden /> Upload materials
  </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
  <DialogHeader>
  <DialogTitle className="text-sm">Upload course materials</DialogTitle>
  <DialogDescription className="text-xs">
  Shared with {departmentName || 'the department'} — students in this department can
  browse them on this page, even before enrolling.
  </DialogDescription>
  </DialogHeader>
  {uploadError && (
  <Alert variant="destructive">
  <AlertDescription className="text-xs">{String(uploadError)}</AlertDescription>
  </Alert>
  )}
  <form onSubmit={submitUpload} className="space-y-3">
  <label
  htmlFor="course-material-files"
  {...dropHandlers}
  className={cn(
  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-all',
  isDragging ? 'border-primary/60 bg-primary/5' : 'border-border/70 hover:border-primary/40 hover:bg-accent/20',
  )}
  >
  <input
  ref={fileInputRef}
  id="course-material-files"
  type="file"
  multiple
  accept={UPLOAD_ACCEPT}
  className="sr-only"
  onChange={(e) => addFiles(e.target.files)}
  />
  {files.length === 0 ? (
  <>
  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
  <UploadCloud className="h-5.5 w-5.5" aria-hidden />
  </span>
  <p className="mt-3 text-sm font-medium">
  Drop files here, or <span className="text-primary">click to browse</span>
  </p>
  <p className="mt-1 text-xs text-muted-foreground">
  Multiple files · PDF, DOCX, PPTX, TXT, MD, CSV, JSON · up to 25 MB each
  </p>
  </>
  ) : (
  <>
  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
  <FileText className="h-5.5 w-5.5" aria-hidden />
  </span>
  <p className="mt-3 text-sm font-medium">
  {files.length} file{files.length === 1 ? '' : 's'} selected
  </p>
  <p className="mt-1 text-xs text-muted-foreground">
  Click to add more
  </p>
  </>
  )}
  </label>

  {files.length > 0 && (
  <ul className="max-h-48 space-y-1.5 overflow-y-auto">
  {files.map((f, i) => (
  <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-2.5 py-2">
  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
  <div className="min-w-0 flex-1">
  <p className="truncate text-xs font-medium">{f.name}</p>
  <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
  </div>
  <button
  type="button"
  aria-label={`Remove ${f.name}`}
  disabled={uploading}
  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
  >
  <X className="h-3.5 w-3.5" aria-hidden />
  </button>
  </li>
  ))}
  </ul>
  )}

  <div className="flex items-center justify-end gap-2 pt-1">
  {uploading ? (
  <div className="flex items-center gap-2 rounded-lg border bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
  {progress.total > 0
  ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total} — ${progress.name}`
  : 'Uploading…'}
  </div>
  ) : (
  <Button type="submit" size="sm" disabled={files.length === 0} className="h-8 gap-1.5 px-4 text-xs">
  <Upload className="h-3.5 w-3.5" aria-hidden /> Upload {files.length > 0 ? `(${files.length})` : ''}
  </Button>
  )}
  </div>
  </form>
  </DialogContent>
  </Dialog>
  )}
  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
  {(resources.data || []).length} item{(resources.data || []).length === 1 ? '' : 's'}
  </span>
  </div>
  </div>
 {resources.isLoading ? (
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="skeleton h-[140px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
 ))}
 </div>
 ) : (resources.data || []).length === 0 ? (
 <EmptyState
 icon={FileText}
 title="No materials yet"
 description="Lecture notes, slides, and readings for this offering will appear here."
 />
 ) : (
 <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {(resources.data || []).map((r) => (
 <li key={r.id}>
 <ResourceCard
 resource={r}
 onOpen={setSelected}
 onDeleted={() => {
 qc.invalidateQueries({ queryKey: ['resources', 'offering', id] });
 qc.invalidateQueries({ queryKey: ['resources'] });
 }}
 />
 </li>
 ))}
 </ul>
 )}
 </div>
 </div>
 )}

 <ResourceDetailDialog
 resource={selected}
 open={!!selected}
 onClose={() => setSelected(null)}
 onUpdate={() => {
 qc.invalidateQueries({ queryKey: ['resources', 'offering', id] });
 qc.invalidateQueries({ queryKey: ['resources'] });
 }}
 />
 </AppShell>
 );
}

function InfoCard({ title, icon: Icon, children }) {
 return (
 <div className="rounded-xl border bg-card p-4">
 <div className="mb-3 flex items-center gap-2">
 <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
 <Icon className="h-3.5 w-3.5" aria-hidden />
 </span>
 <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
 </div>
 {children}
 </div>
 );
}

function DetailRow({ label, value }) {
 return (
 <div className="flex items-center justify-between gap-3 py-2">
 <dt className="text-muted-foreground">{label}</dt>
 <dd className={cn('font-medium')}>{value}</dd>
 </div>
 );
}
