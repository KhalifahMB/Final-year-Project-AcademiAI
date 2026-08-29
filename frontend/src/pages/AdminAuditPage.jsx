import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { dashboardApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ScrollText, Search, Activity, ShieldAlert, UserCog } from "lucide-react";

export default function AdminAuditPage() {
  const [days, setDays] = useState(14);
  const [search, setSearch] = useState("");

  const logs = useQuery({
    queryKey: ["audit-logs-full"],
    queryFn: async () => {
      const { data } = await api.get("/audit-logs/?page_size=200");
      return data.results || data;
    },
  });

  const summary = useQuery({
    queryKey: ["admin-audit-summary", days],
    queryFn: () => dashboardApi.adminAuditSummary(days),
    staleTime: 60_000,
  });

  const allLogs = logs.data || [];
  const s = summary.data || {};
  const timeline = s.timeline || [];
  const byAction = s.by_action || [];
  const byEntity = s.by_entity_type || [];
  const topActors = s.top_actors || [];

  const filtered = allLogs.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.action || "").toLowerCase().includes(q) ||
      (a.entity_type || "").toLowerCase().includes(q) ||
      (a.actor_name || a.actor || "").toString().toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      title="Audit Logs"
      description="Security events and user activity across your institution. Use the charts to spot trends, and the table below to drill into individual events."
    >
      {logs.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Could not load audit logs.</AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Events in last {days}d</p>
              <p className="text-xl font-bold">{s.total_events ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--warn-soft)] text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Distinct actions</p>
              <p className="text-xl font-bold">{byAction.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Active actors</p>
              <p className="text-xl font-bold">{topActors.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + breakdowns */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Activity over time
          </CardTitle>
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  days === d
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-muted/40" />
          ) : timeline.length === 0 ? (
            <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No events in this window.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="h-56 lg:col-span-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString([], { month: "short", day: "numeric" })
                      }
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Events"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Top actions
                  </p>
                  <ul className="space-y-1 text-sm">
                    {byAction.slice(0, 6).map((a) => (
                      <li key={a.name} className="flex items-center justify-between gap-3">
                        <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                          {a.name}
                        </code>
                        <span className="font-semibold">{a.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Entity types
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {byEntity.map((e) => (
                      <span
                        key={e.name}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                      >
                        {e.name} <strong>{e.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event log table */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base">Recent events</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions, actors, entities…"
              className="h-9 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">No entries match your search.</p>
          ) : (
            <ul className="divide-y">
              {filtered.slice(0, 100).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold">{a.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{a.entity_type}</span>
                      {a.entity_id ? <span className="font-mono"> · {String(a.entity_id).slice(0, 8)}…</span> : null}
                      {a.actor_name || a.actor ? <> · <span>{a.actor_name || a.actor}</span></> : null}
                      {a.ip_address ? <> · <span className="font-mono">{a.ip_address}</span></> : null}
                    </p>
                    {a.metadata && Object.keys(a.metadata).length > 0 && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
                        {JSON.stringify(a.metadata).slice(0, 140)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground" title={a.created_at}>
                    {formatRelativeTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
