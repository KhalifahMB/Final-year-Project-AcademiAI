import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/shared/StatCard';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { useAuth } from '@/hooks/useAuth';
import {
  ClipboardList,
  FileText,
  GraduationCap,
  MessageSquareText,
  StickyNote,
  TrendingUp,
  Upload,
  Users,
  Sparkles,
  Clock,
  ArrowRight,
  Plus,
  Flame,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function SectionHeader({ title, action, description }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function SegmentedControl({ value, options, onChange, size = 'sm' }) {
  return (
    <div
      className={cn(
        'inline-flex rounded-lg border bg-muted/50 p-0.5',
        size === 'xs' ? 'text-[11px]' : 'text-xs',
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            value === o.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isSuper = !!user?.is_superuser;
  const isAdmin = user?.role === 'admin' || isSuper;
  const isStaff = isAdmin || isSuper;
  const isLecturer = user?.role === 'lecturer';
  const isStudent = !isAdmin && !isLecturer && !isSuper;
  const firstName = user?.first_name || user?.email?.split('@')?.[0] || 'there';

  // Pick aggregate endpoint by role
  const endpoint = isAdmin || isSuper
    ? dashboardApi.admin
    : isLecturer
      ? dashboardApi.lecturer
      : dashboardApi.student;
  const dash = useQuery({
    queryKey: [isStaff ? 'dash-admin' : 'dash-student'],
    queryFn: endpoint,
    staleTime: 60_000,
    retry: 1,
  });

  const c = dash.data?.counts || {};
  const t = dash.data?.totals || {};

  const [studentRange, setStudentRange] = useState('day');
  const studentActivity = useQuery({
    queryKey: ['student-activity', studentRange],
    queryFn: () => dashboardApi.studentActivity(studentRange),
    staleTime: 60_000,
    enabled: !isStaff,
  });

  const [auditDays, setAuditDays] = useState(14);
  const auditSummary = useQuery({
    queryKey: ['admin-audit-summary', auditDays],
    queryFn: () => dashboardApi.adminAuditSummary(auditDays),
    staleTime: 60_000,
    enabled: isStaff,
  });

  const stats = isStaff
    ? [
        { icon: Users, label: 'Total users', value: t.users, hint: 'In your institution' },
        { icon: FileText, label: 'Materials', value: t.resources, hint: `${t.enrollments || 0} enrollments` },
        { icon: ClipboardList, label: 'Quizzes', value: t.quizzes, hint: `${t.quiz_attempts || 0} attempts` },
        { icon: MessageSquareText, label: 'AI chats', value: t.chat_sessions, hint: `${t.chat_messages || 0} messages` },
      ]
    : [
        { icon: GraduationCap, label: 'Enrolled courses', value: c.enrollments, hint: 'This semester' },
        { icon: FileText, label: 'Materials', value: c.resources, hint: 'Available to study' },
        { icon: ClipboardList, label: 'Quiz attempts', value: c.quiz_attempts, hint: 'Practice sessions' },
        { icon: StickyNote, label: 'Notes & bookmarks', value: (c.notes || 0) + (c.bookmarks || 0), hint: `${c.notes || 0} notes · ${c.bookmarks || 0} bookmarks` },
      ];

  const quickActions = useMemo(
    () => {
      const base = [
        {
          to: '/chat',
          label: 'Ask the AI',
          icon: MessageSquareText,
          desc: 'Grounded Q&A with citations',
          primary: true,
        },
        { to: '/resources', label: 'Browse resources', icon: FileText, desc: 'Course materials & documents' },
        { to: '/quizzes', label: 'Practice quizzes', icon: ClipboardList, desc: 'Test your understanding' },
        { to: '/notes', label: 'My notes', icon: StickyNote, desc: 'Personal study space' },
      ];
      if (isStaff) {
        base.push({ to: '/resources/upload', label: 'Upload resource', icon: Upload, desc: 'Add new course material' });
      }
      if (isAdmin) {
        base.push({ to: '/admin/dashboard', label: 'Institution analytics', icon: TrendingUp, desc: 'Users, activity, health' });
        base.push({ to: '/admin/users', label: 'Manage users', icon: Users, desc: 'Roles & access' });
      }
      return base.slice(0, isStaff ? 6 : 4);
    },
    [isStaff, isAdmin],
  );

  const enrolledCourses = dash.data?.enrolled_courses || [];
  const recentResources = dash.data?.recent_resources || [];
  const recentChats = dash.data?.recent_chats || [];

  const studentChart = studentActivity.data?.timeline || [];
  const auditTimeline = auditSummary.data?.timeline || [];
  const auditActions = auditSummary.data?.by_action || [];
  const auditEntities = auditSummary.data?.by_entity_type || [];
  const auditActors = auditSummary.data?.top_actors || [];
  const auditRecent = auditSummary.data?.recent || [];

  return (
    <AppShell>
      {/* Greeting strip */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Flame className="h-3 w-3 text-orange-500" aria-hidden />
            {greeting()},
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl">
            {firstName}
            <span className="text-muted-foreground"> — welcome back.</span>
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {isStaff
              ? "Here's what's happening across your institution today."
              : "Here's what's waiting in your study workspace."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <Link
              to="/chat"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-[12px] font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ask anything
            </Link>
          )}
          {isStaff && (
            <Link
              to="/resources/upload"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Upload material
            </Link>
          )}
        </div>
      </div>

      {dash.isLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
            ))}
          </div>

          {/* Quick actions */}
          <section className="mt-6">
            <SectionHeader title="Quick actions" />
            <div className="grid gap-2.5 grid-cols-2 md:grid-cols-4">
              {quickActions.map(({ to, label, icon: Icon, desc, primary }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md',
                    primary && 'border-primary/25 bg-gradient-to-br from-primary/5 via-transparent to-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      primary
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight">{label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              ))}
            </div>
          </section>

          {/* Student chart */}
          {!isStaff && (
            <section className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
              <SectionHeader
                title="Study activity"
                description="Chats, quiz attempts, and notes over time."
                action={
                  <SegmentedControl
                    value={studentRange}
                    onChange={setStudentRange}
                    options={[
                      { id: 'hour', label: 'Hour' },
                      { id: 'day', label: 'Day' },
                      { id: 'week', label: 'Week' },
                      { id: 'month', label: 'Month' },
                    ]}
                  />
                }
              />
              {studentActivity.isLoading ? (
                <div className="h-56 animate-pulse rounded-lg bg-muted/40" />
              ) : studentChart.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">
                  Start a chat or take a quiz to see your study patterns.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={studentChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          if (studentRange === 'hour') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (studentRange === 'month') return d.toLocaleDateString([], { month: 'short' });
                          return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="chats" name="Chats" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="quizzes" name="Quizzes" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="notes" name="Notes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}

          {/* Role grid */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {isStaff ? (
              <>
                <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
                  <SectionHeader title="Material pipeline" />
                  <div className="grid grid-cols-4 gap-2">
                    {(dash.data?.materials_by_status || []).map((s) => (
                      <div key={s.name} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                        <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{s.name}</p>
                      </div>
                    ))}
                  </div>
                  {recentResources?.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent uploads
                      </p>
                      <ul className="divide-y">
                        {recentResources.slice(0, 5).map((r) => (
                          <li key={r.id}>
                            <Link
                              to={`/resources`}
                              className="flex items-center justify-between gap-3 rounded-md -mx-2 px-2 py-2 text-[13px] transition-colors hover:bg-accent/40"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="truncate font-medium">{r.title}</span>
                                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                                  · {r.uploaded_by || 'unknown'}
                                </span>
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                <TimeAgo iso={r.created_at} />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <SectionHeader title="Academic structure" />
                  <ul className="space-y-2">
                    {(dash.data?.structure || []).map((s) => (
                      <li key={s.name} className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-semibold tabular-nums">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
                  <SectionHeader
                    title="My courses"
                    action={
                      <Link
                        to="/my-courses"
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                      >
                        View all
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    }
                  />
                  {enrolledCourses.length === 0 ? (
                    <p className="py-5 text-center text-[12px] text-muted-foreground">
                      You're not enrolled in any courses yet.
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {enrolledCourses.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          <Link
                            to={`/courses/${c.id}`}
                            className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/40 -mx-2"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[10px] font-bold text-primary">
                              {(c.code || 'CRS').slice(0, 4)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">{c.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {c.code}
                                {c.semester ? ` · ${c.semester}` : ''}
                              </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-4 shadow-sm">
                  <SectionHeader
                    title="Recent AI chats"
                    action={
                      <Link
                        to="/chat"
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                      >
                        New chat
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    }
                  />
                  {recentChats.length === 0 ? (
                    <p className="py-5 text-center text-[12px] text-muted-foreground">
                      No conversations yet. Try asking the AI!
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {recentChats.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          <Link
                            to={`/chat?session=${c.id}`}
                            className="group flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-accent/40 -mx-2"
                          >
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">{c.title || 'New chat'}</p>
                              <p className="text-[11px] text-muted-foreground">
                                <TimeAgo iso={c.updated_at} />
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Staff audit analytics */}
          {isStaff && (
            <section className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
              <SectionHeader
                title="Audit & activity"
                description={`${auditSummary.data?.total_events ?? '—'} events in the last ${auditDays} days.`}
                action={
                  <SegmentedControl
                    value={auditDays}
                    onChange={setAuditDays}
                    size="xs"
                    options={[
                      { id: 7, label: '7d' },
                      { id: 14, label: '14d' },
                      { id: 30, label: '30d' },
                      { id: 90, label: '90d' },
                    ]}
                  />
                }
              />
              {auditSummary.isLoading ? (
                <div className="h-56 animate-pulse rounded-lg bg-muted/40" />
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="h-56 lg:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Events over time
                    </p>
                    <div className="h-[calc(100%-22px)]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={auditTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis
                            dataKey="bucket"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) =>
                              new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            }
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="count" name="Events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Top action types
                      </p>
                      <ul className="space-y-1 text-[12px]">
                        {auditActions.slice(0, 6).map((a) => (
                          <li key={a.name} className="flex items-center justify-between gap-3">
                            <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px]">{a.name}</code>
                            <span className="font-semibold tabular-nums">{a.count}</span>
                          </li>
                        ))}
                        {auditActions.length === 0 && (
                          <li className="text-[11px] text-muted-foreground">No events in this window.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Top actors
                      </p>
                      <ul className="space-y-1 text-[12px]">
                        {auditActors.slice(0, 5).map((a, i) => (
                          <li key={i} className="flex items-center justify-between gap-3">
                            <span className="truncate">{a.name}</span>
                            <span className="font-semibold tabular-nums">{a.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Entity types
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {auditEntities.map((e) => (
                          <span
                            key={e.name}
                            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]"
                          >
                            {e.name}
                            <strong className="tabular-nums">{e.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {auditRecent.length > 0 && (
                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent events
                    </p>
                    <Link
                      to={isAdmin && user?.is_superuser ? '/platform/audit' : '/admin/audit'}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      View all
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {auditRecent.slice(0, 6).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px]">{e.action}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {e.entity_type} · {e.actor}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          <TimeAgo iso={e.created_at} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Recent materials for students */}
          {!isAdmin && recentResources?.length > 0 && (
            <section className="mt-6">
              <SectionHeader
                title="Recently added"
                description="New materials uploaded to your courses."
                action={
                  <Link
                    to="/resources"
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                  >
                    Browse all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              />
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {recentResources.slice(0, 6).map((r) => (
                  <Link
                    key={r.id}
                    to={`/resources`}
                    className="group flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight">{r.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] capitalize text-muted-foreground">
                        {r.visibility_scope}
                        <span>·</span>
                        <Clock className="h-3 w-3" aria-hidden />
                        <TimeAgo iso={r.updated_at} />
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
