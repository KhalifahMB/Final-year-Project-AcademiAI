import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowRight,
  BookOpen,
  Building2,
  GraduationCap,
  Landmark,
  LibraryBig,
  TrendingUp,
} from 'lucide-react';

function ChainRow({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-[14px] font-semibold">{value || '—'}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export default function MyProgrammePage() {
  const { user } = useAuth();
  const programmeId = user?.programme_id || null;
  const departmentId = user?.department_id || null;

  const programmeQ = useQuery({
    queryKey: ['my-programme', programmeId],
    queryFn: async () => (await api.get(`/programmes/${programmeId}/`)).data,
    enabled: !!programmeId,
    staleTime: 5 * 60_000,
  });
  const departmentQ = useQuery({
    queryKey: ['my-department', departmentId],
    queryFn: async () => (await api.get(`/departments/${departmentId}/`)).data,
    enabled: !!departmentId,
    staleTime: 5 * 60_000,
  });
  const facultyId = departmentQ.data?.faculty || null;
  const facultyQ = useQuery({
    queryKey: ['my-faculty', facultyId],
    queryFn: async () => (await api.get(`/faculties/${facultyId}/`)).data,
    enabled: !!facultyId,
    staleTime: 5 * 60_000,
  });
  // Department course count for the "browse" link context.
  const deptCoursesQ = useQuery({
    queryKey: ['my-department-courses', departmentId],
    queryFn: async () => {
      const { data } = await api.get('/courses/', { params: { department: departmentId, page_size: 1 } });
      return data;
    },
    enabled: !!departmentId,
    staleTime: 5 * 60_000,
  });

  const loading = programmeQ.isLoading || departmentQ.isLoading;
  const loadError = programmeQ.error || departmentQ.error;
  const programme = programmeQ.data || null;
  const department = departmentQ.data || null;
  const faculty = facultyQ.data || null;
  const deptCourseCount = deptCoursesQ.data?.count;

  const refetchAll = () => {
    programmeQ.refetch();
    departmentQ.refetch();
    facultyQ.refetch();
  };

  return (
    <AppShell
      title="My programme"
      description="Your place in your institution's academic structure."
    >
      {loadError ? (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Could not load your programme details.</span>
            <Button type="button" variant="outline" size="sm" onClick={refetchAll} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[220px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ) : !programme && !department ? (
        <EmptyState
          icon={GraduationCap}
          title="No programme attached yet"
          description="Your institution hasn't linked your profile to a programme. Contact your administrator — once attached, your programme, department and faculty appear here."
          action="Browse the catalogue"
          actionTo="/courses"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Your programme hero */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)]">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Your programme</h3>
                <p className="text-[11px] text-muted-foreground">
                  {programme ? 'Attached by your institution' : 'Not attached yet — contact your admin'}
                </p>
              </div>
              {programme && (
                <Badge className="ml-auto shrink-0 border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  Yours
                </Badge>
              )}
            </div>
            {programme ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-wide text-[var(--accent-strong)]">
                    {programme.code}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold leading-snug tracking-tight">
                    {programme.name}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {[programme.degree_type, programme.duration_years ? `${programme.duration_years} years` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Degree programme'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
                    <Link to={departmentId ? `/courses?dept=${departmentId}` : '/courses'}>
                      Browse department courses <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Link to="/my-courses">My courses</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Once your administrator attaches a programme to your profile, its full details —
                degree type, duration and department links — live here.
              </p>
            )}
          </div>

          {/* Academic chain */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Landmark className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Academic chain</h3>
                <p className="text-[11px] text-muted-foreground">Faculty → department → programme</p>
              </div>
            </div>
            <div className="space-y-4">
              <ChainRow
                icon={Landmark}
                label="Faculty"
                value={faculty?.name}
                hint={faculty?.code}
              />
              <ChainRow
                icon={Building2}
                label="Department"
                value={department?.name}
                hint={department?.code}
              />
              <ChainRow
                icon={BookOpen}
                label="Programme"
                value={programme?.name}
                hint={programme?.code}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Link to="/progress">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden /> My progress
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <Link to="/courses">
                  <LibraryBig className="h-3.5 w-3.5" aria-hidden /> Full catalogue
                  {typeof deptCourseCount === 'number' && departmentId
                    ? ` (${deptCourseCount} in dept)`
                    : ''}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
