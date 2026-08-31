import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import ResourceCard from '@/components/resources/ResourceCard';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
 ArrowLeft,
 BookOpen,
 CalendarDays,
 Clock,
 FileText,
 GraduationCap,
} from 'lucide-react';

export default function CourseDetailPage() {
 const { id } = useParams();
 const { user } = useAuth();
 const role = user?.role;

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

 {/* Resources */}
 <div>
 <div className="mb-3 flex items-center justify-between">
 <h2 className="text-sm font-semibold tracking-tight">Course materials</h2>
 <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
 {(resources.data || []).length} item{(resources.data || []).length === 1 ? '' : 's'}
 </span>
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
 <ResourceCard resource={r} />
 </li>
 ))}
 </ul>
 )}
 </div>
 </div>
 )}
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
