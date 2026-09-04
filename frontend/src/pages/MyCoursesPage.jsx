import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import StatTile from '@/components/shared/StatTile';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MyCoursesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unenrollingId, setUnenrollingId] = useState(null);
  const [confirmUnenroll, setConfirmUnenroll] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const { data } = await api.get('/course-enrollments/mine/');
      return data.results || data;
    },
    select: (data) => data || [],
  });

  // React Query's `select` is not applied while the first load is pending
  // (data is undefined), so fall back to a stable empty array.
  const enrollments = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const active = enrollments.filter(
      (e) => e.status === 'enrolled' || e.status === 'active',
    ).length;
    const completed = enrollments.filter(
      (e) => e.status === 'completed',
    ).length;
    return { total: enrollments.length, active, completed };
  }, [enrollments]);

  const unenrollMutation = useMutation({
    mutationFn: (offeringId) =>
      api.post('/course-enrollments/unenroll/', {
        course_offering: offeringId,
      }),
    onMutate: (offeringId) => setUnenrollingId(offeringId),
    onSettled: () => {
      setUnenrollingId(null);
      setConfirmUnenroll(null);
    },
    onSuccess: () => {
      toast.success('Successfully unenrolled from course');
      qc.invalidateQueries({ queryKey: ['my-enrollments'] });
      qc.invalidateQueries({ queryKey: ['course-enrollments'] });
    },
    onError: (e) => {
      const msg =
        e?.response?.data?.detail || e?.message || 'Failed to unenroll';
      toast.error(msg);
    },
  });

  const handleUnenrollClick = (e, enrollment) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmUnenroll(enrollment);
  };

  const confirmUnenrollAction = () => {
    if (confirmUnenroll) {
      unenrollMutation.mutate(confirmUnenroll.course_offering);
    }
  };

  return (
    <AppShell
      title="My courses"
      description="Your enrollments for the current academic sessions."
    >
      {!isLoading && enrollments.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <StatTile label="Enrolled" value={counts.total} icon={BookOpen} />
          <StatTile
            label="Active"
            value={counts.active}
            icon={GraduationCap}
            tone="emerald"
          />
          <StatTile label="Completed" value={counts.completed} tone="violet" />
        </div>
      )}

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-xs">
            <span className="font-medium">Failed to load enrollments.</span>{' '}
            {String(error?.response?.data?.detail || error.message || error)}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-[84px] rounded-xl"
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No enrollments yet"
          description={
            user?.role === 'student'
              ? 'You are not enrolled in any courses yet. Browse the catalogue and enrol yourself, or ask an admin to enrol you.'
              : 'When your institution enrols you in course offerings, they\u2019ll show up here.'
          }
          actionTo={user?.role === 'student' ? '/courses' : undefined}
          action={
            user?.role === 'student' ? 'Browse course catalogue' : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {enrollments.map((e) => {
              const isUnenrolling = unenrollingId === e.course_offering;
              const canUnenroll =
                user?.role === 'student' &&
                (e.status === 'enrolled' || e.status === 'active');

              return (
                <li key={e.id} className="group relative">
                  <Link
                    to={`/courses/${e.course_offering}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-[var(--border-strong)]"
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
                        {[e.semester_name, e.session_name]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <div className="mt-1.5">
                        <StatusBadge status={e.status} />
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </Link>

                  {canUnenroll && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isUnenrolling}
                      onClick={(evt) => handleUnenrollClick(evt, e)}
                      // Hover-only actions are unreachable on touch screens:
                      // keep the button visible below the md breakpoint and
                      // on keyboard focus everywhere.
                      className="absolute right-2 top-2 h-7 w-7 p-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      aria-label={`Unenroll from ${e.offering_course_code || 'course'}`}
                    >
                      {isUnenrolling ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          <AlertDialog
            open={!!confirmUnenroll}
            onOpenChange={(open) => !open && setConfirmUnenroll(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unenroll from course?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to unenroll from{' '}
                  <span className="font-medium text-foreground">
                    {confirmUnenroll?.offering_course_code || 'this course'}
                  </span>
                  ? You'll lose access to course materials, chat history, and
                  progress data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmUnenrollAction}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Unenroll
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AppShell>
  );
}
