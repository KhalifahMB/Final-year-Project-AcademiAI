import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronRight, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MyCoursesPage() {
 const { user } = useAuth();
 const { data, isLoading, error, refetch } = useQuery({
 queryKey: ['my-enrollments'],
 queryFn: async () => {
 const { data } = await api.get('/course-enrollments/');
 return data.results || data;
 },
 });

 const enrollments = data || [];

 const counts = useMemo(() => {
 const active = enrollments.filter((e) => e.status === 'enrolled' || e.status === 'active').length;
 const completed = enrollments.filter((e) => e.status === 'completed').length;
 return { total: enrollments.length, active, completed };
 }, [enrollments]);

 return (
 <AppShell
 title="My courses"
 description="Your enrollments for the current academic sessions."
 >
 {!isLoading && enrollments.length > 0 && (
 <div className="mb-4 grid grid-cols-3 gap-2.5">
 <StatTile label="Enrolled" value={counts.total} icon={BookOpen} />
 <StatTile label="Active" value={counts.active} icon={GraduationCap} tone="emerald" />
 <StatTile label="Completed" value={counts.completed} tone="violet" />
 </div>
 )}

 {error ? (
 <Alert variant="destructive" className="mb-4">
 <AlertDescription className="text-xs">
 <span className="font-medium">Failed to load enrollments.</span>{' '}
 {String(error?.response?.data?.detail || error.message || error)}
 </AlertDescription>
 <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => refetch()}>
 Retry
 </Button>
 </Alert>
 ) : null}

 {isLoading ? (
 <div className="grid gap-3 sm:grid-cols-2">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="skeleton h-[84px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
 ))}
 </div>
 ) : enrollments.length === 0 ? (
 <EmptyState
 icon={GraduationCap}
 title="No enrollments yet"
 description={
 user?.role === 'student'
 ? 'Enrollments are created automatically from your programme. If you just signed up, an admin can also enroll you manually.'
 :"When your institution enrolls you in course offerings, they'll show up here."
 }
 actionTo={user?.role === 'student' ? '/my-programme' : undefined}
 action={user?.role === 'student' ? 'View my programme' : undefined}
 />
 ) : (
 <ul className="grid gap-3 sm:grid-cols-2">
 {enrollments.map((e) => (
 <li key={e.id}>
 <Link
 to={`/courses/${e.course_offering}`}
 className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-all transition-colors hover:border-[var(--border-strong)]"
 >
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]">
 <BookOpen className="h-[18px] w-[18px]" aria-hidden />
 </span>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium">
 {e.offering_course_code
 ? `${e.offering_course_code} — ${e.offering_course_title || ''}`
 : 'Course offering'}
 </p>
 <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
 {[e.semester_name, e.session_name].filter(Boolean).join(' · ') || '—'}
 </p>
 <div className="mt-1.5">
 <StatusBadge status={e.status} />
 </div>
 </div>
 <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
 </Link>
 </li>
 ))}
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
