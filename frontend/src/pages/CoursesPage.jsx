import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronRight, GraduationCap } from 'lucide-react';

function CourseCard({ course }) {
  return (
    <li>
      <Link
        to={`/courses/${course.id}`}
        className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_4px_16px_-8px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-primary">
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
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View <ChevronRight className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function CoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses/');
      return data.results || data;
    },
  });

  const courses = data || [];
  const activeCount = courses.filter((c) => c.status === 'active').length;

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
          {courses.map((c) => <CourseCard key={c.id} course={c} />)}
        </ul>
      )}
    </AppShell>
  );
}

function StatTile({ label, value, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-primary bg-primary/10',
    emerald: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    violet: 'text-violet-600 bg-violet-500/10 dark:text-violet-400',
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
