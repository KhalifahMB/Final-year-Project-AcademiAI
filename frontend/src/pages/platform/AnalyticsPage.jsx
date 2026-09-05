import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/shared/StatCard";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, MessageSquareText, ClipboardList, HardDrive, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

const PIE_COLORS = [
  "oklch(0.55 0.25 293)",
  "oklch(0.6 0.2 255)",
  "oklch(0.65 0.16 215)",
  "oklch(0.7 0.14 175)",
];

const chartTooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  fontSize: "12px",
  color: "var(--card-foreground)",
};

export default function AnalyticsPage() {
  const statsQ = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => (await platformApi.stats()).data,
    staleTime: 30_000,
  });

  const stats = statsQ.data;

  return (
    <AppShell
      title="Analytics"
      description="Platform-wide growth trends, usage metrics, and resource consumption."
    >
      {statsQ.isLoading ? (
        <SkeletonRows rows={6} />
      ) : statsQ.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Failed to load analytics.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => statsQ.refetch()} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : stats ? (
        <>
          {/* ── Summary Row ────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Users joined (30d)" value={stats.users?.joined_this_month} hint={`${stats.users?.joined_this_week} this week`} />
            <StatCard icon={FileText} label="Resources uploaded (30d)" value={stats.resources?.uploaded_this_month} hint={`${stats.resources?.uploaded_this_week} this week`} />
            <StatCard icon={MessageSquareText} label="Chat messages (7d)" value={stats.chat?.messages_this_week} hint="Active AI usage" />
            <StatCard icon={ClipboardList} label="Quiz attempts" value={stats.quizzes?.total_attempts} hint={`${stats.quizzes?.total} quizzes created`} />
          </div>

          {/* ── Charts Grid ────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* User signups trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> User signups (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.trends?.user_signups?.length > 0 ? (
                  <div className="h-[260px]">
                    <p className="sr-only">
                      User signups over the last 30 days, {stats.trends.user_signups.length} data points,
                      latest: {stats.trends.user_signups[stats.trends.user_signups.length - 1]?.count ?? 0} signups.
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.trends.user_signups}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v?.slice(5)} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Line type="monotone" dataKey="count" stroke="oklch(0.55 0.25 293)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No signup data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Tenant provisioning trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> Tenant provisioning (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.trends?.tenant_provisioning?.length > 0 ? (
                  <div className="h-[260px]">
                    <p className="sr-only">
                      Tenants provisioned over the last 30 days, {stats.trends.tenant_provisioning.length} data points.
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.trends.tenant_provisioning}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v?.slice(5)} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="oklch(0.6 0.18 255)" maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No provisioning data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Users by role pie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" aria-hidden /> Users by role
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.users?.by_role && Object.keys(stats.users.by_role).length > 0 ? (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(stats.users.by_role).map(([name, value]) => ({
                              name: name.charAt(0).toUpperCase() + name.slice(1),
                              value,
                            }))}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {Object.entries(stats.users.by_role).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      {Object.entries(stats.users.by_role).map(([role, count], i) => (
                        <li key={role} className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden />
                          {role} · <span className="font-medium text-foreground">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No user data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Resource pipeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" aria-hidden /> Resource pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.resources?.by_status && Object.keys(stats.resources.by_status).length > 0 ? (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(stats.resources.by_status).map(([name, value]) => ({
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            value,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.55 0.25 293)" maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span>Total: {stats.resources.total} resources</span>
                      <span>·</span>
                      <span>Storage: {formatBytes(stats.resources.total_storage_bytes)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No resource data yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Storage & vectors full-width */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4 text-primary" aria-hidden /> Storage & embeddings overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{stats.resources?.total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total resources</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{formatBytes(stats.resources?.total_storage_bytes)}</p>
                    <p className="text-xs text-muted-foreground">Storage used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{stats.resources?.total_chunks || 0}</p>
                    <p className="text-xs text-muted-foreground">Vector chunks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums">{stats.chat?.total_messages || 0}</p>
                    <p className="text-xs text-muted-foreground">AI messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
