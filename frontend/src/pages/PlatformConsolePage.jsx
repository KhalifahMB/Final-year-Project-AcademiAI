import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { platformApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/shared/StatCard';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Building2,
  FileText,
  MessageSquareText,
  Users,
  ClipboardList,
  HardDrive,
  Megaphone,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

const PIE_COLORS = [
  'var(--accent-strong)',
  'var(--accent)',
  'var(--info)',
  'var(--success)',
];

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
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

function QuickActionCard({ to, icon: Icon, label, description }) {
  return (
    <Link
      to={to}
      className="card-surface card-surface-hover group flex items-center gap-4 rounded-2xl p-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}

export default function PlatformConsolePage() {
  const statsQ = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => (await platformApi.stats()).data,
    staleTime: 30_000,
  });

  const stats = statsQ.data;

  return (
    <AppShell
      title="Platform Dashboard"
      description="Overview of AcademiAI — tenants, users, resources, and AI activity across the platform."
    >
      {statsQ.isLoading ? (
        <SkeletonRows rows={6} />
      ) : statsQ.error ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 text-center">
          <p className="text-sm font-medium text-destructive">
            Platform statistics could not be loaded.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => statsQ.refetch()}>
            Retry
          </Button>
        </div>
      ) : stats ? (
        <>
          {/* ── Summary Cards ──────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={Building2}
              label="Tenants"
              value={stats.tenants?.total}
              hint={`${stats.tenants?.active} active`}
            />
            <StatCard
              icon={Users}
              label="Users"
              value={stats.users?.total}
              hint={`${stats.users?.joined_this_week} new this week`}
            />
            <StatCard
              icon={FileText}
              label="Resources"
              value={stats.resources?.total}
              hint={formatBytes(stats.resources?.total_storage_bytes)}
            />
            <StatCard
              icon={MessageSquareText}
              label="Chat Sessions"
              value={stats.chat?.total_sessions}
              hint={`${stats.chat?.total_messages} messages`}
            />
            <StatCard
              icon={ClipboardList}
              label="Quizzes"
              value={stats.quizzes?.total}
              hint={`${stats.quizzes?.total_attempts} attempts`}
            />
            <StatCard
              icon={HardDrive}
              label="Vectors"
              value={stats.resources?.total_chunks}
              hint="Embedded chunks"
            />
          </div>

          {/* ── Quick Actions ──────────────────────────────────────── */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              to="/platform/tenants"
              icon={Building2}
              label="Manage Tenants"
              description="View and configure all institutions"
            />
            <QuickActionCard
              to="/platform/analytics"
              icon={TrendingUp}
              label="Analytics"
              description="Growth trends and usage metrics"
            />
            <QuickActionCard
              to="/platform/health"
              icon={Activity}
              label="System Health"
              description="Service status and worker queues"
            />
            <QuickActionCard
              to="/platform/announcements"
              icon={Megaphone}
              label="Announcements"
              description="Send messages to tenants"
            />
          </div>

          {/* ── Charts ─────────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* User signups trend */}
            {stats.trends?.user_signups?.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" aria-hidden /> User
                  signups (30 days)
                </h2>
                <p className="sr-only">
                  User signups over the last 30 days, {stats.trends.user_signups.length} data points,
                  latest: {stats.trends.user_signups[stats.trends.user_signups.length - 1]?.count ?? 0} signups.
                </p>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trends.user_signups}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v?.slice(5)}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--accent-strong)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Tenant plan distribution */}
            {stats.tenants?.by_plan &&
              Object.keys(stats.tenants.by_plan).length > 0 && (
                <section className="rounded-2xl border bg-card p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden />{' '}
                    Tenants by plan
                  </h2>
                  <div className="mt-4 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(stats.tenants.by_plan).map(
                            ([name, value]) => ({ name, value }),
                          )}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {Object.entries(stats.tenants.by_plan).map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {Object.entries(stats.tenants.by_plan).map(
                      ([plan, count], i) => (
                        <li key={plan} className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                PIE_COLORS[i % PIE_COLORS.length],
                            }}
                            aria-hidden
                          />
                          {plan} ·{' '}
                          <span className="font-medium text-foreground">
                            {count}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}

            {/* Users by role */}
            {stats.users?.by_role &&
              Object.keys(stats.users.by_role).length > 0 && (
                <section className="rounded-2xl border bg-card p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-primary" aria-hidden /> Users
                    by role
                  </h2>
                  <div className="mt-4 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(stats.users.by_role).map(
                          ([name, value]) => ({
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            value,
                          }),
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fontSize: 11,
                            fill: 'var(--muted-foreground)',
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fontSize: 11,
                            fill: 'var(--muted-foreground)',
                          }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[8, 8, 0, 0]}
                          fill="var(--accent)"
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

            {/* Top tenants */}
            {stats.top_tenants?.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden />{' '}
                  Top tenants by users
                </h2>
                <div className="mt-4 space-y-2.5">
                  {stats.top_tenants.slice(0, 6).map((t, i) => (
                    <div key={`${t.tenant__name}-${i}`} className="flex items-center gap-3">
                      <span className="w-32 truncate text-xs text-muted-foreground">
                        {t.tenant__name}
                      </span>
                      <div
                        className="flex-1"
                        role="progressbar"
                        aria-valuenow={t.user_count}
                        aria-valuemin={0}
                        aria-valuemax={stats.top_tenants[0]?.user_count || 1}
                        aria-label={`${t.tenant__name} users ${t.user_count}`}
                      >
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary/70"
                            style={{
                              width: `${Math.min(100, (t.user_count / (stats.top_tenants[0]?.user_count || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-xs font-semibold tabular-nums">
                        {t.user_count}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Resource pipeline */}
            {stats.resources?.by_status &&
              Object.keys(stats.resources.by_status).length > 0 && (
                <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" aria-hidden />{' '}
                    Resource pipeline
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.resources.uploaded_this_week} uploaded this week ·{' '}
                    {formatBytes(stats.resources.total_storage_bytes)} total
                    storage
                  </p>
                  <div className="mt-4 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(stats.resources.by_status).map(
                          ([name, value]) => ({
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            value,
                          }),
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fontSize: 11,
                            fill: 'var(--muted-foreground)',
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fontSize: 11,
                            fill: 'var(--muted-foreground)',
                          }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[8, 8, 0, 0]}
                          fill="var(--accent-strong)"
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
