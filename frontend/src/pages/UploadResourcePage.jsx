import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatBytes, getFileType, SCOPE_META } from '@/lib/filetypes';
import {
 ArrowLeft,
 CheckCircle2,
 CloudUpload,
 FileText,
 FileUp,
 Info,
 Loader2,
 ShieldCheck,
 Sparkles,
 UploadCloud,
 X,
} from 'lucide-react';

const ACCEPT = '.txt,.md,.pdf,.docx,.pptx,.json,.csv,.xlsx,.ppt,.doc,.xls';
const ACCEPT_EXTENSIONS = ACCEPT.split(',').map((s) => s.trim().toLowerCase());
const ACCEPT_HINT = 'PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, JSON';
const MAX_BYTES = 25 * 1024 * 1024;
const SCOPES = ['private', 'course', 'programme', 'department', 'faculty', 'institution'];

const OBJECT_TYPES = [
 { value: 'none', field: null, label: 'Not linked', hint: 'Standalone material' },
 { value: 'course', field: 'course_offering', label: 'Course offering', hint: 'Assign to an offering' },
 { value: 'programme', field: 'programme', label: 'Programme', hint: 'Assign to a programme' },
 { value: 'department', field: 'department', label: 'Department', hint: 'Assign to a department' },
 { value: 'faculty', field: 'faculty', label: 'Faculty', hint: 'Assign to a faculty' },
];

const STEPS = [
 { label: 'Creating resource record', hint: 'Saving metadata' },
 { label: 'Requesting upload link', hint: 'Authorizing storage' },
 { label: 'Uploading file', hint: 'Encrypted transfer' },
 { label: 'Queueing extraction & index', hint: 'AI ingestion' },
];

export default function UploadResourcePage() {
 const qc = useQueryClient();
 const navigate = useNavigate();
 const inputRef = useRef(null);

 const [description, setDescription] = useState('');
 const [scope, setScope] = useState('course');
 const [objectType, setObjectType] = useState(
  scope === 'course' ? 'course' : 'none'
 );
 const [objectId, setObjectId] = useState('');
 const [files, setFiles] = useState([]);
 const [isDragging, setIsDragging] = useState(false);
 const [step, setStep] = useState(-1);
 const [error, setError] = useState('');
 const [done, setDone] = useState(null);
 const [fileIndex, setFileIndex] = useState(0);

 const objectEnabled = objectType !== 'none';

 const listQuery =
  objectType === 'course'
   ? { key: 'offerings', url: '/course-offerings/?page_size=200' }
   : objectType === 'programme'
     ? { key: 'programmes', url: '/programmes/?page_size=200' }
     : objectType === 'department'
       ? { key: 'departments', url: '/departments/?page_size=200' }
       : { key: 'faculties', url: '/faculties/?page_size=200' };

 const objects = useQuery({
  queryKey: [listQuery.key, objectEnabled],
  queryFn: async () => {
   const { data } = await api.get(listQuery.url);
   return data.results || data;
  },
  enabled: objectEnabled,
  staleTime: 60_000,
 });

 const renderObjectLabel = (o) => {
  if (objectType === 'course')
   return o.course_code ? `${o.course_code} — ${o.course_title || ''}` : o.id;
  return o.name || o.code || o.id;
 };

 const uploadOne = async (f, { titleOverride, index }) => {
  setFileIndex(index);
  setStep(0);
  const payload = {
  title: titleOverride || f.name || 'Upload',
  description,
  visibility_scope: scope,
  };
  if (objectEnabled) {
   const field = OBJECT_TYPES.find((o) => o.value === objectType)?.field;
   if (field) payload[field] = objectId;
  }
  const { data: resource } = await api.post('/resources/', payload);

  setStep(1);
  const contentType = f.type || 'application/octet-stream';
  const { data: presign } = await api.post(
  `/resources/${resource.id}/request_upload_url/`,
  { content_type: contentType },
  );

  setStep(2);
  const form = new FormData();
  Object.entries(presign.form_fields || {}).forEach(([k, v]) => form.append(k, v));
  form.append('file', f);
  const put = await fetch(presign.upload_url, { method: 'POST', body: form });
  if (!put.ok) throw new Error('Storage rejected the upload. Check the file size/type and retry.');

  setStep(3);
  const { data: completion } = await api.post(
  `/resources/${resource.id}/complete_upload/`,
  { storage_key: presign.storage_key },
  );
  return { resource, job_id: completion.job_id };
 };

 const upload = useMutation({
  mutationFn: async (list) => {
  const created = [];
  for (let i = 0; i < list.length; i++) {
   const f = list[i];
   const preferTitle = list.length > 1
    ? f.name.replace(/\.[^.]+$/, '')
    : null;
   created.push(await uploadOne(f, { index: i, titleOverride: preferTitle }));
  }
  return { resources: created };
  },
  onSuccess: ({ resources }) => {
  setDone(resources);
  toast.success(
   resources.length === 1
    ? 'Upload complete — processing started'
    : `${resources.length} files uploaded — processing started`,
  );
  qc.invalidateQueries({ queryKey: ['resources'] });
  qc.invalidateQueries({ queryKey: ['dash-resources'] });
  qc.invalidateQueries({ queryKey: ['dash-courses'] });
  },
  onError: (e) => {
  setError(e.response?.data?.error?.detail || e.message || 'Upload failed');
  setStep(-1);
  },
 });

 const setFilesWithValidation = useCallback((incoming, add = false) => {
  setError('');
  const next = add ? [...files] : [];
  let rejected = '';
  for (const f of incoming) {
  const dot = f.name.lastIndexOf('.');
  const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : '';
  if (ext && !ACCEPT_EXTENSIONS.includes(ext)) {
   rejected = `“${f.name}” is not a supported type. Use ${ACCEPT_HINT}.`;
   continue;
  }
  if (f.size > MAX_BYTES) {
   rejected = `File exceeds the 25 MB limit (${formatBytes(f.size)}).`;
   continue;
  }
  if (!next.some((existing) => existing.name === f.name && existing.size === f.size)) {
   next.push(f);
  }
  }
  setFiles(next);
  if (rejected) setError(rejected);
 }, [files]);

 const removeFile = (index) => {
  setFiles((prev) => prev.filter((_, i) => i !== index));
 };

 const submit = (e) => {
  e.preventDefault();
  setError('');
  if (files.length === 0) { setError('Choose at least one file to upload.'); return; }
  const over = files.some((f) => f.size > MAX_BYTES);
  if (over) { setError('One or more files exceed the 25 MB limit.'); return; }
  if (objectEnabled && !objectId) {
  setError('Select the object this material belongs to.');
  return;
  }
  upload.mutate(files);
 };

 const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
 const onDragLeave = () => setIsDragging(false);
 const onDrop = (e) => {
  e.preventDefault();
  setIsDragging(false);
  const dropped = Array.from(e.dataTransfer.files || []);
  if (dropped.length) setFilesWithValidation(dropped, true);
 };

 const totalSize = files.reduce((acc, f) => acc + f.size, 0);

 if (done) {
  const multiple = done.length > 1;
  return (
  <AppShell
   title="Upload material"
   description="Share course materials with your institution."
  >
   <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center view-enter">
   <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/12">
    <CheckCircle2 className="h-7 w-7 text-[var(--success)]" aria-hidden />
   </span>
   <h2 className="mt-4 text-base font-semibold">
    {multiple
     ? `${done.length} files uploaded`
     : `“${done[0].title}” uploaded`}
   </h2>
   <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
    {multiple
     ? 'All files are stored securely. Text extraction, chunking, and embedding are now running.'
     : 'Your file is stored securely. Text extraction, chunking, and embedding are now running — the status below updates automatically.'}
   </p>
   <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
    {done.map((r) => (
    <StatusBadge key={r.id} status={r.processing_status || 'pending'} />
    ))}
   </div>
   <div className="mt-6 flex justify-center gap-2">
    <Button variant="outline" size="sm" onClick={() => navigate('/resources')} className="h-9">
    Go to resources
    </Button>
    <Button
    size="sm"
    onClick={() => {
     setDone(null);
     setFiles([]);
     setDescription('');
     setObjectId('');
    }}
    className="h-9"
    >
    Upload more
    </Button>
   </div>
   </div>
  </AppShell>
   );
  }

  return (
 <AppShell
 title="Upload material"
 description="Files are extracted, chunked, and indexed so the AI assistant can cite them in answers."
 actions={
 <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground">
 <Link to="/resources">
 <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
 Back to library
 </Link>
 </Button>
 }
 >
 <form onSubmit={submit} className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1.4fr_1fr]">
 {/* LEFT: form */}
 <div className="space-y-5">
 {error ? (
 <Alert variant="destructive" role="alert">
 <AlertDescription className="text-xs">{String(error)}</AlertDescription>
 </Alert>
 ) : null}

  {/* Dropzone + file list */}
  <div className="rounded-xl border bg-card p-1">
   {files.length === 0 ? (
    <label
     htmlFor="file"
     onDragOver={onDragOver}
     onDragLeave={onDragLeave}
     onDrop={onDrop}
     className={cn(
      'relative flex cursor-pointer flex-col items-center justify-center rounded-lg px-6 py-12 text-center transition-all',
      'border-2 border-dashed',
      isDragging
       ? 'border-primary/60 bg-primary/5'
       : 'border-border/70 hover:border-primary/40 hover:bg-accent/20',
     )}
    >
     <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
      <UploadCloud className="h-7 w-7" aria-hidden />
     </span>
     <p className="mt-4 text-sm font-medium">
      Drop files here, or <span className="text-primary">click to browse</span>
     </p>
     <p className="mt-1 text-xs text-muted-foreground">
      {ACCEPT_HINT} · up to 25 MB each · select multiple
     </p>
     <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
       <ShieldCheck className="h-3 w-3 text-[var(--success)]" aria-hidden />
       Tenant-isolated storage
      </span>
      <span className="inline-flex items-center gap-1">
       <Sparkles className="h-3 w-3 text-primary" aria-hidden />
       Auto-indexed for AI
      </span>
     </div>
    </label>
   ) : (
    <div>
     <ul className="divide-y">
      {files.map((f, i) => {
       const ft = getFileType(f.name, f.type);
       const isActive = upload.isPending && fileIndex === i;
       return (
        <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-3 py-2.5">
         <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {ft ? <ft.icon className="h-4.5 w-4.5" aria-hidden /> : <FileText className="h-4.5 w-4.5" aria-hidden />}
         </span>
         <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{f.name}</p>
          <p className="text-xs text-muted-foreground">
           {ft?.label} · {formatBytes(f.size)}
           {isActive && ' · uploading…'}
          </p>
         </div>
         {isActive && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />}
         {!upload.isPending && (
          <Button
           type="button"
           variant="ghost"
           size="sm"
           className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
           aria-label={`Remove ${f.name}`}
           onClick={() => removeFile(i)}
          >
           <X className="h-4 w-4" aria-hidden />
          </Button>
         )}
        </li>
       );
      })}
     </ul>
     <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
      <p className="text-xs text-muted-foreground">
       {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
      </p>
      <Button
       type="button"
       variant="secondary"
       size="sm"
       className="h-8 gap-1.5 text-xs"
       onClick={() => inputRef.current?.click()}
       disabled={upload.isPending}
      >
       <FileUp className="h-3.5 w-3.5" aria-hidden />
       Add more
      </Button>
     </div>
    </div>
   )}
   <input
    ref={inputRef}
    id="file"
    type="file"
    accept={ACCEPT}
    multiple
    className="sr-only"
    onChange={(e) => {
     const list = Array.from(e.target.files || []);
     if (list.length) setFilesWithValidation(list, files.length > 0);
     e.target.value = '';
    }}
   />
  </div>

 {/* Metadata */}
 <div className="rounded-xl border bg-card p-5">
 <div className="mb-3 flex items-center gap-2">
 <span className="h-5 w-1 rounded-full bg-[var(--accent)]" />
 <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
 Metadata
 </h3>
 </div>

  <div className="space-y-3.5">
   <p className="text-[11px] leading-snug text-muted-foreground">
    The description and visibility below apply to every selected file.
    Each file is titled from its filename.
   </p>

   <div className="space-y-1.5">
    <Label htmlFor="desc" className="text-xs">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
    <Textarea
     id="desc"
     value={description}
     onChange={(e) => setDescription(e.target.value)}
     placeholder="Summarize what these materials cover so they're easier to search."
     className="min-h-[72px] text-sm"
    />
   </div>

   <div className="space-y-1.5">
    <Label className="text-xs">Visibility scope</Label>
    <Select value={scope} onValueChange={setScope}>
     <SelectTrigger className="h-9 w-full capitalize text-sm">
      <SelectValue />
     </SelectTrigger>
     <SelectContent>
      {SCOPES.map((s) => (
       <SelectItem key={s} value={s} className="text-sm">
        <span className={cn('mr-2 inline-block h-2 w-2 rounded-full align-middle', SCOPE_META[s].dot)} />
        {SCOPE_META[s].label}
       </SelectItem>
      ))}
     </SelectContent>
    </Select>
    <p className="text-[11px] leading-snug text-muted-foreground">
     {scope === 'private' && 'Only you can find and summarize this material.'}
     {scope === 'course' && 'Enrolled students and the lecturer can access it.'}
     {scope === 'programme' && 'Shared within your programme.'}
     {scope === 'department' && 'Shared within your department.'}
     {scope === 'faculty' && 'Shared across your faculty.'}
     {scope === 'institution' && 'Visible to everyone at your institution.'}
    </p>
   </div>

   <div className="space-y-1.5">
    <Label className="text-xs">Link to <span className="font-normal text-muted-foreground">(optional)</span></Label>
    <Select
     value={objectType}
     onValueChange={(v) => {
      setObjectType(v);
      setObjectId('');
     }}
    >
     <SelectTrigger className="h-9 w-full text-sm">
      <SelectValue />
     </SelectTrigger>
     <SelectContent>
      {OBJECT_TYPES.map((o) => (
       <SelectItem key={o.value} value={o.value} className="text-sm">
        {o.label}
       </SelectItem>
      ))}
     </SelectContent>
    </Select>
    <p className="text-[11px] leading-snug text-muted-foreground">
     {OBJECT_TYPES.find((o) => o.value === objectType)?.hint}
    </p>
   </div>

   {objectEnabled && (
    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
     <Label className="text-xs">
      {objectType === 'course' ? 'Course offering' : `Select ${objectType}`}
     </Label>
     <Select value={objectId || undefined} onValueChange={setObjectId}>
      <SelectTrigger className="h-9 w-full text-sm">
       <SelectValue
        placeholder={
         objects.isLoading
          ? 'Loading…'
          : (objects.data || []).length === 0
            ? 'Nothing available'
            : 'Select…'
        }
       />
      </SelectTrigger>
      <SelectContent>
       {(objects.data || []).map((o) => (
        <SelectItem key={o.id} value={o.id} className="text-sm">
         {renderObjectLabel(o)}
        </SelectItem>
       ))}
      </SelectContent>
     </Select>
     <p className="text-[11px] leading-snug text-muted-foreground">
      {objectType === 'course'
       ? 'Enrolled students and the assigned lecturer will see this material.'
       : 'Files are filed under the selected object in the tenant structure.'}
     </p>
    </div>
   )}
  </div>
 </div>

 {/* Submit */}
 <div className="flex items-center justify-between">
 <p className="text-[11px] text-muted-foreground">
 By uploading you confirm you have the right to share this material.
 </p>
  {upload.isPending ? (
    <div role="status" className="flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-2 text-xs">
     <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
     {files.length > 1 && (
      <span className="font-medium text-muted-foreground">File {fileIndex + 1} of {files.length} · </span>
     )}
     {STEPS[Math.min(step, STEPS.length - 1)].label}…
    </div>
   ) : (
    <Button type="submit" disabled={files.length === 0} size="sm" className="h-9 gap-2 px-5 text-xs font-medium">
     <CloudUpload className="h-3.5 w-3.5" aria-hidden />
     {files.length > 1 ? `Upload & process ${files.length} files` : 'Upload & process'}
    </Button>
   )}
  </div>

  {/* Steps progress during upload */}
  {upload.isPending && (
   <div className="rounded-xl border bg-card p-4">
   <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
    {files.length > 1
     ? `Uploading file ${fileIndex + 1} of ${files.length}`
     : 'Upload progress'}
   </p>
 <ol className="space-y-2">
 {STEPS.map((s, i) => {
 const doneStep = i < step;
 const active = i === step;
 return (
 <li key={s.label} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
 <span
 className={cn(
 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
 doneStep && 'border-[var(--success)]/50 bg-[var(--success-soft)] text-[var(--success)] ',
 active && 'border-primary/50 bg-primary/10 text-primary',
 !doneStep && !active && 'border-border bg-muted/30 text-muted-foreground',
 )}
 >
 {doneStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
 </span>
 <div className="min-w-0 flex-1">
 <p className={cn('text-xs font-medium', active ? 'text-foreground' : doneStep ? 'text-muted-foreground line-through' : 'text-muted-foreground')}>
 {s.label}
 </p>
 <p className="text-[10px] text-muted-foreground">{s.hint}</p>
 </div>
 {active && <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />}
 </li>
 );
 })}
 </ol>
 </div>
 )}
 </div>

 {/* RIGHT: info sidebar */}
 <aside className="space-y-4 lg:sticky lg:top-[68px] lg:self-start">
 <div className="rounded-xl border bg-[var(--surface-2)] p-5">
 <div className="flex items-center gap-2">
 <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-primary dark:bg-white/10">
 <Sparkles className="h-4 w-4" aria-hidden />
 </span>
 <h3 className="text-sm font-semibold">What happens next?</h3>
 </div>
 <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-foreground/80">
 <li className="flex gap-2">
 <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">1</span>
 <span>Your file is stored in your tenant's encrypted object-storage partition.</span>
 </li>
 <li className="flex gap-2">
 <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">2</span>
 <span>A background worker extracts text from PDFs, DOCX, PPTX and splits it into semantic chunks.</span>
 </li>
 <li className="flex gap-2">
 <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">3</span>
 <span>Embeddings are generated so the AI can cite exact pages in chat answers.</span>
 </li>
 <li className="flex gap-2">
 <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">4</span>
 <span>You (and anyone in the chosen scope) can preview, download, bookmark, and summarize the material.</span>
 </li>
 </ol>
 </div>

 <div className="rounded-xl border bg-card p-5">
 <div className="flex items-start gap-2.5">
 <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
 <div>
 <h4 className="text-xs font-semibold">Tips</h4>
 <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
 <li>• Text-based PDFs index best; scanned PDFs need OCR.</li>
 <li>• A good description improves AI retrieval quality.</li>
 <li>• You can generate multiple AI summaries per document.</li>
 <li>• You can change visibility after upload.</li>
 </ul>
 </div>
 </div>
 </div>

 <div className="rounded-xl border bg-card p-4">
 <Link to="/resources" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
 <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
 Browse existing materials
 </Link>
 </div>
 </aside>
 </form>
 </AppShell>
 );
}
