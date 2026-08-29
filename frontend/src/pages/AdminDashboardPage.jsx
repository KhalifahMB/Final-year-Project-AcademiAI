import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/shared/StatCard';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Building2, ClipboardList, FileText, GraduationCap,
  HardDrive, Landmark, TrendingUp, Users, MessageSquareText,
  ScrollText,
} from 'lucide-react';

const PIE_COLORS = [
  'var(--accent-strong)',
  'var(--accent)',
  'var(--info)',
];

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const gb = 1024 ** 3, mb = 1024 ** 2;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

const chartTooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  fontSize: '12px',
  color: 'var(--card-foreground)',
};

function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [auditDays, setAuditDays] = useState(14);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: dashboardApi.admin,
    staleTime: 60_000,
  });

  const auditSummary = useQuery({
    queryKey: ['admin-audit-summary', auditDays],
    queryFn: () => dashboardApi.adminAuditSummary(auditDays),
    staleTime: 60_000,
  });

  const t = data?.totals || {};
  const roleData = (data?.users_by_role || []).filter((d) => d.value > 0);
  const pipelineData = (data?.materials_by_status || []).filter((d) => d.value > 0);
  const structureData = data?.structure || [];
  const recentResources = data?.recent_resources || [];

  const auditTimeline = auditSummary.data?.timeline || [];
  const auditActions = auditSummary.data?.by_action || [];
  const auditActors = auditSummary.data?.top_actors || [];
  const auditRecent = auditSummary.data?.recent || [];

  return (
    <AppShell
      title="Institution dashboard"
      description="Live overview of people, academic structure, the AI material pipeline, and audit analytics."
    >
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={Users} label="Total users" value={t.users} hint="All roles" />
            <StatCard icon={FileText} label="Materials" value={t.resources} hint={formatBytes(t.storage_used_bytes)} />
            <StatCard icon={GraduationCap} label="Enrollments" value={t.enrollments} hint="Active" />
            <StatCard icon={ClipboardList} label="Quizzes" value={t.quizzes} hint={`${t.quiz_attempts || 0} attempts`} />
            <StatCard icon={MessageSquareText} label="Chat sessions" value={t.chat_sessions} hint={`${t.chat_messages || 0} messages`} />
            <StatCard icon={HardDrive} label="Storage used" value={formatBytes(t.storage_used_bytes)} hint="Across resources" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {roleData.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" aria-hidden /> People by role
                </h2>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleData} dataKey="value" nameKey="name"
                        innerRadius={60} outerRadius={95} paddingAngle={3} strokeWidth={0}
                      >
                        {roleData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  {roleData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        aria-hidden
                      />
                      {d.name} · <span className="font-medium text-foreground">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pipelineData.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> Material pipeline
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Where uploaded resources sit in extraction &amp; indexing.
                </p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.55 0.25 293)" maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" aria-hidden /> Academic structure
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                {structureData.map((s) => (
                  <div key={s.name} className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Landmark className="mx-auto mb-1 h-5 w-5 text-primary" />
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.name}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Audit analytics */}
          <section className="mt-6 rounded-2xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4 text-primary" aria-hidden /> Audit &amp; activity analytics
                </h2>
                <p className="text-xs text-muted-foreground">
                  {auditSummary.data?.total_events ?? '—'} events in the last {auditDays} day{auditDays === 1 ? '' : 's'}.
                </p>
              </div>
              <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setAuditDays(d)}
                    className={cn(
                      'rounded-md px-3 py-1 transition-colors',
                      auditDays === d ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
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
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Events over time</p>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={auditTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="count" name="Events" stroke="oklch(0.55 0.25 293)" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
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
                        <p className="text-xs text-muted-foreground">{e.entity_type} · {e.actor}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground"><TimeAgo iso={e.created_at} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {recentResources.length > 0 && (
            <section className="mt-6 rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" aria-hidden /> Recent uploads
              </h2>
              <ul className="mt-3 divide-y">
                {recentResources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <Link to={`/resources/${r.id}`} className="truncate font-medium hover:underline">
                          {r.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.uploaded_by || 'System'} · {r.mime_type || 'document'}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-3">
                      <span className={
                        'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                        (r.status === 'ready'
                          ? 'bg-[var(--success)]/15 text-[var(--success)] '
                          : r.status === 'failed'
                          ? 'bg-[var(--danger)]/15 text-red-700 dark:text-red-400'
                          : 'bg-[var(--warn)]/15 text-amber-700 dark:text-amber-400')
                      }>
                        {r.status}
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        <TimeAgo iso={r.created_at} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Signed in as {user?.email} · figures refresh every minute.
          </p>
        </>
      )}
    </AppShell>
  );
}
