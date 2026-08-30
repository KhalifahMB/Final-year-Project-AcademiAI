import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, ChevronRight, GraduationCap } from 'lucide-react';

const errMsg = (err, fallback) =>
 err?.response?.data?.error?.detail ||
 err?.response?.data?.detail ||
 err?.message ||
 fallback;

function CourseCard({ course, offeringId, enrolled, isStudent, busy, onEnroll, onUnenroll }) {
 const footer = offeringId ? (
  isStudent ? (
   <Button
   type="button"
   size="sm"
   variant={enrolled ? 'outline' : 'default'}
   className="h-7 px-2.5 text-[11px]"
   disabled={busy}
   onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (enrolled) onUnenroll(offeringId);
    else onEnroll(offeringId);
   }}
   >
   {enrolled ? 'Unenrol' : 'Enrol'}
   </Button>
  ) : (
   <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
   View <ChevronRight className="h-3 w-3" aria-hidden />
   </span>
  )
 ) : (
  <span className="text-[10px] text-muted-foreground">No offering yet</span>
 );

 const body = (
 <>
  <div className="flex items-start gap-3">
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
  <BookOpen className="h-5 w-5" aria-hidden />
  </span>
  <div className="min-w-0 flex-1">
  <div className="flex items-center gap-2">
  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary">
  {course.code || '—'}
  </span>
  {course.credit_unit ? (
  <span className="text-[10px] text-muted-foreground">{course.credit_unit} CU</span>
  ) : null}
  </div>
  <h2 className="mt-1.5 truncate text-sm font-semibold leading-snug">
  {course.title}
  </h2>
  </div>
  </div>
  <p className="mt-2.5 line-clamp-2 min-h-[2rem] text-[11.5px] leading-relaxed text-muted-foreground">
  {course.description || 'No description provided.'}
  </p>
  <div className="mt-auto flex items-center justify-between pt-3">
  <span className="text-[10px] text-muted-foreground">
  {course.status === 'active' ? 'Active' : (course.status || 'Course')}
  </span>
  {footer}
  </div>
 </>
 );
 if (!offeringId) {
  return (
  <li>
  <div className="flex h-full cursor-default flex-col rounded-xl border bg-card p-4">
  {body}
  </div>
  </li>
  );
 }
 return (
  <li>
  <Link
  to={`/courses/${offeringId}`}
  className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-[var(--border-strong)]"
  >
  {body}
  </Link>
  </li>
 );
}

export default function CoursesPage() {
 const { user } = useAuth();
 const qc = useQueryClient();
 const [pendingOffering, setPendingOffering] = useState(null);
 const isStudent = user?.role === 'student';

 const { data, isLoading, error } = useQuery({
  queryKey: ['courses'],
  queryFn: async () => {
  const { data } = await api.get('/courses/');
  return data.results || data;
  },
  select: (data) => data || [],
 });
 const courses = useMemo(() => data ?? [], [data]);

 // Course detail links resolve to a course offering (/course-offerings/:id),
 // so map each course to its latest offering (the API returns newest first).
 const { data: offeringData } = useQuery({
  queryKey: ['course-offerings', 'catalogue'],
  queryFn: async () => {
  const { data } = await api.get('/course-offerings/', { params: { page_size: 500 } });
  return data.results || data;
  },
  staleTime: 60_000,
  select: (data) => data || [],
 });
 const offerings = useMemo(() => offeringData ?? [], [offeringData]);

 // Student's current enrollments — same key as MyCoursesPage so both stay in sync.
 const { data: enrollData } = useQuery({
  queryKey: ['my-enrollments'],
  queryFn: async () => {
  const { data } = await api.get('/course-enrollments/');
  return data.results || data;
  },
  enabled: isStudent,
  select: (data) => data || [],
 });
 const enrollments = useMemo(() => enrollData ?? [], [enrollData]);

 const enrolledOfferingIds = useMemo(
  () => new Set(enrollments.map((e) => e.course_offering)),
  [enrollments]
 );

 const invalidateEnrollments = () => {
  qc.invalidateQueries({ queryKey: ['my-enrollments'] });
 };

 const enroll = useMutation({
  mutationFn: (offeringId) => api.post('/course-enrollments/enroll/', { course_offering: offeringId }),
  onMutate: (offeringId) => setPendingOffering(offeringId),
  onSettled: () => setPendingOffering(null),
  onSuccess: () => {
  toast.success('Enrolled in course');
  invalidateEnrollments();
  },
  onError: (e) => toast.error(errMsg(e, 'Could not enrol in this course')),
 });

 const unenroll = useMutation({
  mutationFn: (offeringId) => api.post('/course-enrollments/unenroll/', { course_offering: offeringId }),
  onMutate: (offeringId) => setPendingOffering(offeringId),
  onSettled: () => setPendingOffering(null),
  onSuccess: () => {
  toast.success('Unenrolled from course');
  invalidateEnrollments();
  },
  onError: (e) => toast.error(errMsg(e, 'Could not unenrol from this course')),
 });

 const activeCount = courses.filter((c) => c.status === 'active').length;
 const offeringByCourse = useMemo(() => {
  const map = new Map();
  for (const o of offerings) {
  if (o.course && !map.has(o.course)) map.set(o.course, o.id);
  }
  return map;
 }, [offerings]);

 return (
  <AppShell
  title="Course catalogue"
  description="Every course offered across your institution."
  >
  {/* Stats */}
  {!isLoading && courses.length > 0 && (
  <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
  <StatTile label="Total courses" value={courses.length} icon={BookOpen} />
  <StatTile label="Active" value={activeCount} icon={GraduationCap} tone="emerald" />
  <StatTile
  label="Credit units"
  value={courses.reduce((s, c) => s + (Number(c.credit_unit) || 0), 0)}
  tone="violet"
  />
  </div>
  )}

  {error ? (
  <Alert variant="destructive" className="mb-4">
  <AlertDescription className="text-xs">Failed to load courses</AlertDescription>
  </Alert>
  ) : null}

  {isLoading ? (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
  {Array.from({ length: 6 }).map((_, i) => (
  <div key={i} className="skeleton h-[140px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
  ))}
  </div>
  ) : courses.length === 0 ? (
  <EmptyState
  icon={BookOpen}
  title="The catalogue is empty"
  description="Courses created by your institution's administrators will appear here."
  />
  ) : (
  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
  {courses.map((c) => {
  const offeringId = offeringByCourse.get(c.id);
  return (
  <CourseCard
  key={c.id}
  course={c}
  offeringId={offeringId}
  enrolled={!!offeringId && enrolledOfferingIds.has(offeringId)}
  isStudent={isStudent}
  busy={pendingOffering === offeringId}
  onEnroll={(id) => enroll.mutate(id)}
  onUnenroll={(id) => unenroll.mutate(id)}
  />
  );
  })}
  </ul>
  )}
  </AppShell>
 );
}

function StatTile({ label, value, icon: Icon, tone = 'indigo' }) {
 const tones = {
  indigo: 'text-primary bg-primary/10',
  emerald: 'text-[var(--success)] bg-[var(--success-soft)] ',
  violet: 'text-[var(--accent-strong)] bg-[var(--accent-soft)] ',
 };
 return (
  <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
  {Icon && <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}><Icon className="h-4 w-4" aria-hidden /></span>}
  <div className="min-w-0">
  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
  <p className="text-xl font-semibold tabular-nums tracking-tight">{value ?? 0}</p>
  </div>
  </div>
 );
}