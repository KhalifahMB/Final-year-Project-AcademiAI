import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const ACCEPT = '.txt,.md,.pdf,.docx,.pptx,.json,.csv,.xlsx,.pptx,.ppt,.doc,.xls';
const ACCEPT_HINT = 'PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, JSON';
const MAX_BYTES = 25 * 1024 * 1024;
const SCOPES = ['private', 'course', 'programme', 'department', 'faculty', 'institution'];

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

 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [scope, setScope] = useState('private');
 const [offering, setOffering] = useState('');
 const [file, setFile] = useState(null);
 const [isDragging, setIsDragging] = useState(false);
 const [step, setStep] = useState(-1);
 const [error, setError] = useState('');
 const [done, setDone] = useState(null);

 const offerings = useQuery({
 queryKey: ['offerings-for-upload'],
 queryFn: async () => {
 const { data } = await api.get('/course-offerings/?page_size=200');
 return data.results || data;
 },
 enabled: scope === 'course',
 staleTime: 60_000,
 });

 const upload = useMutation({
 mutationFn: async () => {
 setStep(0);
 const payload = {
 title: title || file?.name || 'Upload',
 description,
 visibility_scope: scope,
 };
 if (scope === 'course' && offering) payload.course_offering = offering;
 const { data: resource } = await api.post('/resources/', payload);

 setStep(1);
 const contentType = file.type || 'application/octet-stream';
 const { data: presign } = await api.post(
 `/resources/${resource.id}/request_upload_url/`,
 { content_type: contentType },
 );

 setStep(2);
 const form = new FormData();
 Object.entries(presign.form_fields || {}).forEach(([k, v]) => form.append(k, v));
 form.append('file', file);
 const put = await fetch(presign.upload_url, { method: 'POST', body: form });
 if (!put.ok) throw new Error('Storage rejected the upload. Check the file size/type and retry.');

 setStep(3);
 const { data: completion } = await api.post(
 `/resources/${resource.id}/complete_upload/`,
 { storage_key: presign.storage_key },
 );
 return { resource, job_id: completion.job_id };
 },
 onSuccess: ({ resource }) => {
 setDone(resource);
 toast.success('Upload complete — processing started');
 qc.invalidateQueries({ queryKey: ['resources'] });
 qc.invalidateQueries({ queryKey: ['dash-resources'] });
 qc.invalidateQueries({ queryKey: ['dash-courses'] });
 },
 onError: (e) => {
 setError(e.response?.data?.error?.detail || e.message || 'Upload failed');
 setStep(-1);
 },
 });

 const setFileWithValidation = useCallback((f) => {
 setError('');
 if (!f) { setFile(null); return; }
 if (f.size > MAX_BYTES) {
 setError(`File exceeds the 25 MB limit (${formatBytes(f.size)}).`);
 return;
 }
 setFile(f);
 if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
 }, [title]);

 const submit = (e) => {
 e.preventDefault();
 setError('');
 if (!file) { setError('Choose a file to upload.'); return; }
 if (file.size > MAX_BYTES) { setError(`File exceeds the 25 MB limit (${formatBytes(file.size)}).`); return; }
 if (scope === 'course' && !offering) {
 setError('Select the course offering this material belongs to.');
 return;
 }
 upload.mutate();
 };

 const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
 const onDragLeave = () => setIsDragging(false);
 const onDrop = (e) => {
 e.preventDefault();
 setIsDragging(false);
 if (e.dataTransfer.files?.[0]) setFileWithValidation(e.dataTransfer.files[0]);
 };

 if (done) {
 return (
 <AppShell
 title="Upload material"
 description="Share course materials with your institution."
 >
 <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center view-enter">
 <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/12">
 <CheckCircle2 className="h-7 w-7 text-[var(--success)]" aria-hidden />
 </span>
 <h2 className="mt-4 text-base font-semibold">“{done.title}” uploaded</h2>
 <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
 Your file is stored securely. Text extraction, chunking, and embedding
 are now running — the status below updates automatically.
 </p>
 <div className="mt-4 flex items-center justify-center gap-2">
 <StatusBadge status={done.processing_status || 'pending'} />
 </div>
 <div className="mt-6 flex justify-center gap-2">
 <Button variant="outline" size="sm" onClick={() => navigate('/resources')} className="h-9">
 Go to resources
 </Button>
 <Button
 size="sm"
 onClick={() => {
 setDone(null);
 setFile(null);
 setTitle('');
 setDescription('');
 }}
 className="h-9"
 >
 Upload another
 </Button>
 </div>
 </div>
 </AppShell>
 );
 }

 const fileType = file ? getFileType(file.name, file.type) : null;

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
 <Alert variant="destructive">
 <AlertDescription className="text-xs">{String(error)}</AlertDescription>
 </Alert>
 ) : null}

 {/* Dropzone */}
 <div className="rounded-xl border bg-card p-1">
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
 file && 'border-primary/30 bg-primary/[0.03]',
 )}
 >
 <input
 ref={inputRef}
 id="file"
 type="file"
 accept={ACCEPT}
 className="sr-only"
 onChange={(e) => setFileWithValidation(e.target.files?.[0] || null)}
 />
 {file ? (
 <div className="flex w-full max-w-md flex-col items-center gap-3">
 <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
 {fileType ? <fileType.icon className="h-6 w-6" aria-hidden /> : <FileText className="h-6 w-6" aria-hidden />}
 </span>
 <div className="min-w-0 max-w-full">
 <p className="truncate text-sm font-medium">{file.name}</p>
 <p className="mt-0.5 text-xs text-muted-foreground">
 {fileType?.label} · {formatBytes(file.size)} · ready to upload
 </p>
 </div>
 <div className="flex items-center gap-2 pt-1">
 <Button
 type="button"
 variant="secondary"
 size="sm"
 className="h-8 gap-1.5 text-xs"
 onClick={(e) => { e.preventDefault(); inputRef.current?.click(); }}
 >
 <FileUp className="h-3.5 w-3.5" aria-hidden />
 Replace file
 </Button>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-8 gap-1.5 text-xs text-muted-foreground"
 onClick={(e) => { e.preventDefault(); setFile(null); }}
 >
 <X className="h-3.5 w-3.5" aria-hidden />
 Remove
 </Button>
 </div>
 </div>
 ) : (
 <>
 <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
 <UploadCloud className="h-7 w-7" aria-hidden />
 </span>
 <p className="mt-4 text-sm font-medium">
 Drop a file here, or{' '}
 <span className="text-primary">click to browse</span>
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 {ACCEPT_HINT} · up to 25 MB
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
 </>
 )}
 </label>
 </div>

 {/* Metadata */}
 <div className="rounded-xl border bg-card p-5">
 <div className="mb-3 flex items-center gap-2">
 <span className="h-5 w-1 rounded-full bg- var(--accent)" />
 <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
 Metadata
 </h3>
 </div>

 <div className="space-y-3.5">
 <div className="space-y-1.5">
 <Label htmlFor="title" className="text-xs">Title</Label>
 <Input
 id="title"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder={file ? file.name.replace(/\.[^.]+$/, '') : 'e.g. CSC401 Week 3 lecture notes'}
 className="h-9 text-sm"
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="desc" className="text-xs">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
 <Textarea
 id="desc"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Summarize what this material covers so it's easier to search."
 className="min-h-[72px] text-sm"
 />
 </div>

 <div className="grid gap-3.5 sm:grid-cols-2">
 <div className="space-y-1.5">
 <Label className="text-xs">Visibility</Label>
 <Select value={scope} onValueChange={setScope}>
 <SelectTrigger className="h-9 w-full capitalize text-sm">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {SCOPES.map((s) => (
 <SelectItem key={s} value={s} className="text-sm">
 <span className={cn('mr-2 inline-block h-2 w-2 rounded-full align-middle', SCOPE_META[s].tint.split(' ')[0].replace('bg-', 'bg-'))} />
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

 {scope === 'course' && (
 <div className="space-y-1.5">
 <Label className="text-xs">Course offering</Label>
 <Select value={offering || undefined} onValueChange={setOffering}>
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
 <SelectContent>
 {(offerings.data || []).map((o) => (
 <SelectItem key={o.id} value={o.id} className="text-sm">
 {o.course_code ? `${o.course_code} — ${o.course_title || ''}` : o.id}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-[11px] leading-snug text-muted-foreground">
 Enrolled students and the assigned lecturer will see this material.
 </p>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Submit */}
 <div className="flex items-center justify-between">
 <p className="text-[11px] text-muted-foreground">
 By uploading you confirm you have the right to share this material.
 </p>
 {upload.isPending ? (
 <div className="flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-2 text-xs">
 <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
 {STEPS[Math.min(step, STEPS.length - 1)].label}…
 </div>
 ) : (
 <Button type="submit" disabled={!file} size="sm" className="h-9 gap-2 px-5 text-xs font-medium">
 <CloudUpload className="h-3.5 w-3.5" aria-hidden />
 Upload & process
 </Button>
 )}
 </div>

 {/* Steps progress during upload */}
 {upload.isPending && (
 <div className="rounded-xl border bg-card p-4">
 <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Upload progress</p>
 <ol className="space-y-2">
 {STEPS.map((s, i) => {
 const doneStep = i < step;
 const active = i === step;
 return (
 <li key={s.label} className="flex items-center gap-3">
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
 <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
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
