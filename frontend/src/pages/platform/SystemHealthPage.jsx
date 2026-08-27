import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, CheckCircle, Database, HardDrive, MessageSquareText, RefreshCw, Server, XCircle } from "lucide-react";

function StatusIndicator({ status }) {
  const config = {
    healthy: { color: "bg-emerald-500", label: "Healthy", icon: CheckCircle },
    degraded: { color: "bg-amber-500", label: "Degraded", icon: Activity },
    unhealthy: { color: "bg-red-500", label: "Unhealthy", icon: XCircle },
    no_workers: { color: "bg-amber-500", label: "No workers", icon: Activity },
  };
  const c = config[status] || config.unhealthy;
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${c.color}`} aria-hidden />
      <Icon className="h-3 w-3" aria-hidden />
      {c.label}
    </span>
  );
}

export default function SystemHealthPage() {
  const healthQ = useQuery({
    queryKey: ["platform-health"],
    queryFn: async () => (await platformApi.health()).data,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const health = healthQ.data;

  return (
    <AppShell
      title="System Health"
      description="Real-time status of PostgreSQL, Redis, RabbitMQ, Celery workers, and object storage."
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() => healthQ.refetch()}
          disabled={healthQ.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${healthQ.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      }
    >
      {healthQ.isLoading ? (
        <SkeletonRows rows={4} />
      ) : healthQ.error ? (
        <Alert variant="destructive"><AlertDescription>Failed to load system health — superuser access required.</AlertDescription></Alert>
      ) : health ? (
        <>
          {/* ── Overall Status Banner ──────────────────────────── */}
          <div className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${
            health.overall === "healthy"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : health.overall === "degraded"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}>
            {health.overall === "healthy" ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : health.overall === "degraded" ? (
              <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
            )}
            <div>
              <p className="text-sm font-semibold capitalize">{health.overall}</p>
              <p className="text-xs text-muted-foreground">
                {health.overall === "healthy"
                  ? "All systems operational."
                  : health.overall === "degraded"
                  ? "Some services are degraded."
                  : "One or more services are down."}
              </p>
            </div>
          </div>

          {/* ── Service Cards ──────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* PostgreSQL */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" aria-hidden />
                    PostgreSQL
                  </span>
                  <StatusIndicator status={health.postgres?.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {health.postgres?.latency_ms != null && <p>Latency: {health.postgres.latency_ms}ms</p>}
                {health.postgres?.error && <p className="text-destructive">Error: {health.postgres.error}</p>}
              </CardContent>
            </Card>

            {/* Redis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" aria-hidden />
                    Redis
                  </span>
                  <StatusIndicator status={health.redis?.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {health.redis?.latency_ms != null && <p>Latency: {health.redis.latency_ms}ms</p>}
                {health.redis?.detail && <p className="text-amber-600">{health.redis.detail}</p>}
                {health.redis?.error && <p className="text-destructive">Error: {health.redis.error}</p>}
              </CardContent>
            </Card>

            {/* RabbitMQ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
                    RabbitMQ
                  </span>
                  <StatusIndicator status={health.rabbitmq?.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {health.rabbitmq?.version && <p>Version: {health.rabbitmq.version}</p>}
                {health.rabbitmq?.erlang_version && <p>Erlang: {health.rabbitmq.erlang_version}</p>}
                {health.rabbitmq?.error && <p className="text-destructive">Error: {health.rabbitmq.error}</p>}
              </CardContent>
            </Card>

            {/* Celery */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" aria-hidden />
                    Celery Workers
                  </span>
                  <StatusIndicator status={health.celery?.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {health.celery?.active_workers != null && <p>Active workers: {health.celery.active_workers}</p>}
                {health.celery?.active_tasks != null && <p>Active tasks: {health.celery.active_tasks}</p>}
                {health.celery?.registered_tasks != null && <p>Registered tasks: {health.celery.registered_tasks}</p>}
                {health.celery?.error && <p className="text-destructive">Error: {health.celery.error}</p>}
              </CardContent>
            </Card>

            {/* Object Storage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-primary" aria-hidden />
                    Object Storage
                  </span>
                  <StatusIndicator status={health.storage?.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {health.storage?.bucket && <p>Bucket: {health.storage.bucket}</p>}
                {health.storage?.error && <p className="text-destructive">Error: {health.storage.error}</p>}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
