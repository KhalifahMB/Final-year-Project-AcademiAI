import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { dashApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  MessageSquareText,
  StickyNote,
  TrendingUp,
  Upload,
  Users,
  ScrollText,
} from 'lucide-react';

function useCount(key, endpoint) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const list = await dashApi[endpoint]();
      return Array.isArray(list) ? list.length : 0;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'lecturer' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const courses = useCount('dash-courses', 'courses');
  const resources = useCount('dash-resources', 'resources');
  const quizzes = useCount('dash-quizzes', 'quizzes');
  const notes = useCount('dash-notes', 'notes');

  // Staff-only: material pipeline snapshot for the tenant (chart below).
  const pipeline = useQuery({
    queryKey: ['dash-pipeline'],
    queryFn: async () => {
      const statuses = ['ready', 'processing', 'pending', 'failed'];
      const counts = await Promise.all(
        statuses.map(async (s) => {
          try {
            const { data } = await api.get('/resources/', {
              params: { processing_status: s, page_size: 1 },
            });
            return { name: s[0].toUpperCase() + s.slice(1), value: data?.count ?? 0 };
          } catch {
            return { name: s, value: 0 };
          }
        }),
      );
      return counts.filter((d) => d.value > 0);
    },
    enabled: isStaff,
    staleTime: 60_000,
  });

  const firstName = user?.first_name ? `, ${user.first_name}` : '';

  const quickActions = [
    {
      to: '/chat',
      label: 'Ask the AI',
      icon: MessageSquareText,
      desc: 'Grounded Q&A with citations',
    },
    {
      to: '/resources',
      label: 'Browse resources',
      icon: FileText,
      desc: 'Course materials & documents',
    },
    {
      to: '/quizzes',
      label: 'Take a quiz',
      icon: ClipboardList,
      desc: 'Practice assessments',
    },
  ];
  if (isStaff) {
    quickActions.push({
      to: '/resources/upload',
      label: 'Upload resource',
      icon: Upload,
      desc: 'Presign, upload & auto-ingest',
    });
  }
  if (isAdmin) {
    quickActions.push(
      {
        to: '/admin/users',
        label: 'Manage users',
        icon: Users,
        desc: 'Tenant accounts & roles',
      },
      {
        to: '/admin/audit',
        label: 'Audit logs',
        icon: ScrollText,
        desc: 'Security-relevant events',
      },
    );
  }

  const title = `Welcome${firstName}`;

  return (
    <AppShell
      title={title}
      description="Here's what's happening across your workspace today."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Courses"
          value={courses.data}
          hint="In your tenant"
        />
        <StatCard
          icon={FileText}
          label="Resources"
          value={resources.data}
          hint="Uploaded materials"
        />
        <StatCard
          icon={ClipboardList}
          label="Quizzes"
          value={quizzes.data}
          hint="Available assessments"
        />
        <StatCard
          icon={StickyNote}
          label="Notes"
          value={notes.data}
          hint="Your personal notes"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ to, label, icon: Icon, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3.5 font-medium">{label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {isStaff && pipeline.data?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Material pipeline
          </h2>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.55 0.25 293)" maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Uploaded materials by processing stage ·{" "}
              <Link to="/admin/dashboard" className="font-medium text-primary hover:underline">
                full institution dashboard →
              </Link>
            </p>
          </div>
        </section>
      )}

      {!isAdmin && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Jump back in
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { to: '/my-courses', label: 'My courses', icon: GraduationCap },
              { to: '/progress', label: 'Learning progress', icon: TrendingUp },
              { to: '/bookmarks', label: 'Saved materials', icon: BookOpen },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {courses.isSuccess && courses.data === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description={
              isAdmin
                ? 'Create faculties, departments, programmes and courses from the Administration section.'
                : "Once your institution sets up courses, they'll appear here."
            }
            action={isAdmin ? 'Set up structure' : undefined}
            actionTo={isAdmin ? '/admin/faculties' : undefined}
          />
        </div>
      )}
    </AppShell>
  );
}
