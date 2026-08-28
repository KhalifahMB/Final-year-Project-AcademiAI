import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { useAuth } from '@/hooks/useAuth';
import {
  BookOpen, BookMarked, ClipboardList, FileText,
  GraduationCap, MessageSquareText, StickyNote,
  TrendingUp, Upload, Users, ScrollText, Sparkles, Clock,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';

function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'lecturer' || user?.role === 'admin' || user?.is_superuser;
  const isAdmin = user?.role === 'admin' || user?.is_superuser;

  const endpoint = isStaff ? dashboardApi.admin : dashboardApi.student;
  const dash = useQuery({
    queryKey: [isStaff ? 'dash-admin' : 'dash-student'],
    queryFn: endpoint,
    staleTime: 60_000,
    retry: 1,
  });

  const firstName = user?.first_name ? `, ${user.first_name}` : '';
  const c = dash.data?.counts || {};
  const t = dash.data?.totals || {};

  // ---- Student activity chart state ----
  const [studentRange, setStudentRange] = useState('day');
  const studentActivity = useQuery({
    queryKey: ['student-activity', studentRange],
    queryFn: () => dashboardApi.studentActivity(studentRange),
    staleTime: 60_000,
    enabled: !isStaff,
  });

  // ---- Admin audit chart state ----
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
        { icon: GraduationCap, label: 'My courses', value: c.enrollments, hint: 'Enrolled this semester' },
        { icon: FileText, label: 'Materials', value: c.resources, hint: 'Available to study' },
        { icon: ClipboardList, label: 'Quiz attempts', value: c.quiz_attempts, hint: 'Practice sessions' },
        { icon: StickyNote, label: 'My notes', value: c.notes, hint: `${c.bookmarks || 0} bookmarks` },
      ];

  const quickActions = [
    { to: '/chat', label: 'Ask the AI', icon: MessageSquareText, desc: 'Grounded Q&A with citations', primary: true },
    { to: '/resources', label: 'Browse resources', icon: FileText, desc: 'Course materials & documents' },
    { to: '/quizzes', label: 'Take a quiz', icon: ClipboardList, desc: 'Practice assessments' },
  ];
  if (isStaff) quickActions.push({ to: '/resources/upload', label: 'Upload resource', icon: Upload, desc: 'Presign, upload & auto-ingest' });
  if (isAdmin) {
    quickActions.push(
      { to: '/admin/dashboard', label: 'Institution dashboard', icon: TrendingUp, desc: 'Full analytics & pipeline' },
      { to: '/admin/users', label: 'Manage users', icon: Users, desc: 'Tenant accounts & roles' },
    );
  }

  const enrolledCourses = dash.data?.enrolled_courses || [];
  const recentResources = dash.data?.recent_resources || [];
  const recentChats = dash.data?.recent_chats || [];
  const recentActivity = dash.data?.recent_resources;

  // ---- Chart helpers ----
  const studentChart = studentActivity.data?.timeline || [];
  const auditTimeline = auditSummary.data?.timeline || [];
  const auditActions = auditSummary.data?.by_action || [];
  const auditEntities = auditSummary.data?.by_entity_type || [];
  const auditActors = auditSummary.data?.top_actors || [];
  const auditRecent = auditSummary.data?.recent || [];

  const rangeButtons = [
    { id: 'hour', label: 'Hour' },
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  const daysButtons = [7, 14, 30, 90];

  return (
    <AppShell
      title={`Welcome${firstName}`}
      description={
        isStaff
          ? "Here's what's happening across your institution today."
          : "Here's what's happening in your study workspace."
      }
    >
      {dash.isLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
            ))}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Quick actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map(({ to, label, icon: Icon, desc, primary }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring',
                    primary && 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent',
                  )}
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

          {/* ------------ STUDENT ANALYTICS ------------ */}
          {!isStaff && (
            <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Study activity
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Chats, quiz attempts, and notes over time.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
                  {rangeButtons.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setStudentRange(r.id)}
                      className={cn(
                        'rounded-md px-3 py-1 transition-colors',
                        studentRange === r.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {studentActivity.isLoading ? (
                <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
              ) : studentChart.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No activity yet — start a chat or take a quiz to see your study patterns.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={studentChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          if (studentRange === 'hour') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (studentRange === 'month') return d.toLocaleDateString([], { month: 'short' });
                          return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="chats" name="Chats" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="quizzes" name="Quizzes" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="notes" name="Notes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}

          {/* ------------ ROLE GRID ------------ */}
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {isStaff ? (
              <>
                <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Material pipeline
                  </h2>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {(dash.data?.materials_by_status || []).map((s) => (
                      <div key={s.name} className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.name}</p>
                      </div>
                    ))}
                  </div>

                  {recentActivity?.length > 0 && (
                    <>
                      <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent uploads
                      </h3>
                      <ul className="divide-y">
                        {recentActivity.slice(0, 5).map((r) => (
                          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{r.title}</span>
                              <span className="text-xs text-muted-foreground">· {r.uploaded_by || 'unknown'}</span>
                            </div>
                            <span className="text-xs text-muted-foreground"><TimeAgo iso={r.created_at} /></span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Academic structure
                  </h2>
                  <ul className="space-y-2">
                    {(dash.data?.structure || []).map((s) => (
                      <li key={s.name} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-semibold">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      My courses
                    </h2>
                    <Link to="/my-courses" className="text-xs font-medium text-primary hover:underline">
                      View all →
                    </Link>
                  </div>
                  {enrolledCourses.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      You're not enrolled in any courses yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {enrolledCourses.slice(0, 5).map((c, i) => (
                        <li key={c.id || i}>
                          <Link
                            to={`/courses/${c.id}`}
                            className="flex items-center gap-3 py-3 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-lg"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-[11px] font-bold">
                              {c.code?.slice(0, 4) || 'CRS'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.title}</p>
                              <p className="text-xs text-muted-foreground">{c.code} · {c.semester}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent chats
                    </h2>
                    <Link to="/chat" className="text-xs font-medium text-primary hover:underline">
                      New chat →
                    </Link>
                  </div>
                  {recentChats.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No conversations yet. Try asking the AI!
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {recentChats.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          <Link
                            to={`/chat?session=${c.id}`}
                            className="flex items-start gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-accent/40"
                          >
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.title || 'New chat'}</p>
                              <p className="text-[11px] text-muted-foreground"><TimeAgo iso={c.updated_at} /></p>
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

          {/* ------------ ADMIN AUDIT ANALYTICS ------------ */}
          {isStaff && (
            <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <ScrollText className="h-4 w-4" /> Audit & activity analytics
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {auditSummary.data?.total_events ?? '—'} events in the last {auditDays} day{auditDays === 1 ? '' : 's'}.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
                  {daysButtons.map((d) => (
                    <button
                      key={d}
                      onClick={() => setAuditDays(d)}
                      className={cn(
                        'rounded-md px-3 py-1 transition-colors',
                        auditDays === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {auditSummary.isLoading ? (
                <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
              ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="h-64 lg:col-span-2">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">Activity over time</p>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={auditTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="bucket"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
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

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Top action types</p>
                      <ul className="space-y-1 text-sm">
                        {auditActions.slice(0, 6).map((a) => (
                          <li key={a.name} className="flex items-center justify-between gap-3">
                            <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">{a.name}</code>
                            <span className="font-semibold">{a.count}</span>
                          </li>
                        ))}
                        {auditActions.length === 0 && (
                          <li className="text-xs text-muted-foreground">No events in this window.</li>
                        )}
                      </ul>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Top actors</p>
                      <ul className="space-y-1 text-sm">
                        {auditActors.slice(0, 5).map((a, i) => (
                          <li key={i} className="flex items-center justify-between gap-3">
                            <span className="truncate">{a.name}</span>
                            <span className="font-semibold">{a.count}</span>
                          </li>
                        ))}
                        {auditActors.length === 0 && (
                          <li className="text-xs text-muted-foreground">No actors yet.</li>
                        )}
                      </ul>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Entity types</p>
                      <div className="flex flex-wrap gap-1.5">
                        {auditEntities.map((e) => (
                          <span
                            key={e.name}
                            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                          >
                            {e.name} <strong>{e.count}</strong>
                          </span>
                        ))}
                        {auditEntities.length === 0 && <span className="text-xs text-muted-foreground">None yet.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {auditRecent.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Recent audit events</p>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/admin/audit">View all →</Link>
                    </Button>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {auditRecent.slice(0, 6).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs">{e.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.entity_type} · {e.actor}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <TimeAgo iso={e.created_at} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {!isAdmin && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="mr-1.5 inline-block h-4 w-4" /> Recently available materials
              </h2>
              {recentResources.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No materials yet"
                  description="Once lecturers upload course resources, they'll appear here."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentResources.slice(0, 6).map((r) => (
                    <Link
                      key={r.id}
                      to={`/resources/${r.id}`}
                      className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <FileText className="h-5 w-5 text-primary" />
                      <p className="mt-2 truncate font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {r.visibility_scope} · <TimeAgo iso={r.updated_at} />
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {isAdmin && (
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { to: '/admin/audit', label: 'Audit logs', icon: ScrollText, desc: 'Security events' },
                { to: '/platform/tenants', label: 'Platform console', icon: BookMarked, desc: 'Only visible to superusers' },
                { to: '/admin/faculties', label: 'Academic structure', icon: GraduationCap, desc: 'Faculties, Depts, Programmes' },
              ].map(({ to, label, icon: Icon, desc }) => (
                <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
