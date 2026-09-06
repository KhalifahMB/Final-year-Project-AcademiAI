import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import StatTile from '@/components/shared/StatTile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, ChevronRight, GraduationCap, Loader2, Search, X } from 'lucide-react';

const errMsg = (err, fallback) =>
 err?.response?.data?.error?.detail ||
 err?.response?.data?.detail ||
 err?.message ||
 fallback;

function CourseCard({ course, offeringId, enrolled, isStudent, busy, onEnroll, onUnenroll }) {
 // No button-inside-link nesting: the card is a plain container, the title
 // is the link, and enrol/unenrol actions sit beside it as siblings.
 const title = (
  <>
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
  </>
 );

 const footer = offeringId ? (
  isStudent ? (
  <Button
  type="button"
  size="sm"
  variant={enrolled ? 'outline' : 'default'}
  className="h-7 gap-1 px-2.5 text-[11px]"
  disabled={busy}
  aria-busy={busy}
  onClick={() => {
  if (enrolled) onUnenroll(offeringId);
  else onEnroll(offeringId);
  }}
  >
  {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
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

 return (
  <li>
  <div className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-[var(--border-strong)]">
  <div className="flex items-start gap-3">
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
  <BookOpen className="h-5 w-5" aria-hidden />
  </span>
  <div className="min-w-0 flex-1">
  {offeringId ? (
  <Link to={`/courses/${offeringId}`} className="rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
  {title}
  </Link>
  ) : (
  title
  )}
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
  </div>
  </li>
  );
}

export default function CoursesPage() {
 const { user } = useAuth();
 const qc = useQueryClient();
 const [pendingOffering, setPendingOffering] = useState(null);
 const isStudent = user?.role === 'student';

 const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['courses'],
  queryFn: async () => {
  const { data } = await api.get('/courses/');
  return data.results || data;
  },
  select: (data) => data || [],
 });
 const courses = useMemo(() => data ?? [], [data]);

  const [searchParams] = useSearchParams();
  const urlDept = searchParams.get('dept');
  const [deptFilter, setDeptFilter] = useState(
  () => urlDept || 'all',
  );
  const [deptTouched, setDeptTouched] = useState(!!urlDept);
  // The auth profile often arrives after first render: apply the student's
  // home-department default then (render-time adjustment, same pattern as
  // AppShell's drawer state) unless the user already chose a filter.
  if (!deptTouched && !urlDept && isStudent && user?.department_id && deptFilter === 'all') {
  setDeptTouched(true);
  setDeptFilter(user.department_id);
  }
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

 // Every department that owns at least one course in the catalogue, so the
 // filter list reflects what the institution actually offers.
 const departments = useMemo(() => {
  const map = new Map();
  for (const c of courses) {
  if (!c.department) continue;
  if (!map.has(c.department)) {
  map.set(c.department, { id: c.department, name: c.department_name || 'Unknown department' });
  }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
 }, [courses]);

 const filtered = useMemo(() => {
  let list = courses;
  if (deptFilter !== 'all') list = list.filter((c) => c.department === deptFilter);
  const q = search.trim().toLowerCase();
  if (q) {
  list = list.filter(
  (c) =>
  (c.title || '').toLowerCase().includes(q) ||
  (c.code || '').toLowerCase().includes(q),
  );
  }
  return list;
 }, [courses, deptFilter, search]);

  const hasFilters = deptFilter !== 'all' || search.trim() !== '';
  const resetFilters = () => {
  setDeptTouched(true);
  setDeptFilter(isStudent ? user?.department_id || 'all' : 'all');
  setSearch('');
  };
  const handleDeptFilter = (v) => {
  setDeptTouched(true);
  setDeptFilter(v);
  };

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
  const { data } = await api.get('/course-enrollments/mine/');
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
  {/* Filters */}
  {!isLoading && courses.length > 0 && (
  <div className="mb-4 flex flex-col gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
  <Select value={deptFilter} onValueChange={handleDeptFilter}>
  <SelectTrigger aria-label="Filter by department" className="h-9 w-full text-sm sm:w-56">
  <SelectValue placeholder="All departments" />
  </SelectTrigger>
  <SelectContent>
  <SelectItem value="all" className="text-sm">All departments</SelectItem>
  {departments.map((d) => (
  <SelectItem key={d.id} value={d.id} className="text-sm">{d.name}</SelectItem>
  ))}
  </SelectContent>
  </Select>
  <div className="relative flex-1">
  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
  <Input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Search by code or title…"
  aria-label="Search courses by code or title"
  className="h-9 pl-8 text-sm"
  />
  </div>
  {hasFilters && (
  <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-[11px] text-muted-foreground">
  <X className="h-3.5 w-3.5" aria-hidden /> Clear
  </Button>
  )}
  <span className="shrink-0 text-[11px] text-muted-foreground">
  {filtered.length} of {courses.length} course{courses.length === 1 ? '' : 's'}
  </span>
  </div>
  )}

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
  <div className="flex w-full items-center justify-between gap-3">
  <AlertDescription className="text-xs">{errMsg(error, 'Failed to load courses')}</AlertDescription>
  <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 h-7 text-[11px]">
  Retry
  </Button>
  </div>
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
  ) : filtered.length === 0 ? (
  <EmptyState
  icon={Search}
  title="No courses match your filters"
  description={deptFilter !== 'all' ? 'Try another department, or clear the filters above to see the full catalogue.' : 'Try a different search term.'}
  />
  ) : (
  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
  {filtered.map((c) => {
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