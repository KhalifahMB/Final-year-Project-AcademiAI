import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BookOpen, ChevronRight, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

 export default function AssignedCoursesPage() {
 const { data, isLoading, error, refetch } = useQuery({
 queryKey: ['lecturer-assignments'],
 queryFn: async () => {
 const { data } = await api.get('/lecturer-assignments/');
 return data.results || data;
 },
 });

 const list = data || [];

 return (
 <AppShell
 title="Assigned courses"
 description="Course offerings you are teaching this session."
 >
 {error && (
 <Alert variant="destructive" className="mb-4">
 <div className="flex w-full items-center justify-between gap-3">
 <AlertDescription className="text-xs">Failed to load assignments</AlertDescription>
 <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 h-7 text-[11px]">
 Retry
 </Button>
 </div>
 </Alert>
 )}
 {isLoading ? (
 <div className="grid gap-3 sm:grid-cols-2">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="skeleton h-[84px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
 ))}
 </div>
 ) : list.length === 0 ? (
 <EmptyState
 icon={GraduationCap}
 title="No assignments yet"
 description="Your administrator assigns course offerings to lecturers."
 />
 ) : (
 <ul className="grid gap-3 sm:grid-cols-2">
 {list.map((a) => (
 <li key={a.id}>
 <Link
 to={`/courses/${a.course_offering}`}
 className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-all transition-colors hover:border-[var(--border-strong)]"
 >
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]">
 <BookOpen className="h-[18px] w-[18px]" aria-hidden />
 </span>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium">
 {a.offering_course_code
 ? `${a.offering_course_code} — ${a.offering_course_title || ''}`
 : 'Course offering'}
 </p>
 <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
 {[a.semester_name, a.session_name].filter(Boolean).join(' · ') || '—'}
 </p>
 <div className="mt-1.5">
 <span className={cn(
 'rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
 a.assignment_role === 'primary'
 ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)] '
 : 'border-muted-foreground/20 bg-muted text-muted-foreground',
 )}>
 {a.assignment_role || 'Lecturer'}
 </span>
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
