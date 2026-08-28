import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ScrollText } from "lucide-react";

const ACTION_STYLES = {
  "user.signup": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  "user.login": "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
  "user.email_verified": "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
  "user.password_change": "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
  "resource.create": "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
  "resource.delete": "bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25",
  "tenant.update": "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300 border-zinc-500/25",
};

function ActionBadge({ action }) {
  const style = ACTION_STYLES[action] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {action}
    </span>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const logsQ = useQuery({
    queryKey: ["platform-audit-logs", page, actionFilter, entityFilter],
    queryFn: async () => {
      const params = { page, page_size: 20 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      const { data } = await platformApi.auditLogs(params);
      return data;
    },
    staleTime: 15_000,
  });

  const data = logsQ.data;
  const results = data?.results || [];
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / 20);

  return (
    <AppShell
      title="Platform Audit Log"
      description="Cross-tenant security audit trail — all administrative and security-sensitive actions."
    >
      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Filter by entity type..."
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="w-[200px]"
        />
      </div>

      {logsQ.isLoading ? (
        <SkeletonRows rows={8} />
      ) : logsQ.error ? (
        <Alert variant="destructive"><AlertDescription>Failed to load audit logs — superuser access required.</AlertDescription></Alert>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl card-surface">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Tenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{log.actor_email || "—"}</TableCell>
                    <TableCell><ActionBadge action={log.action} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span>{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="ml-1 font-mono text-[10px]">{log.entity_id.slice(0, 8)}…</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.tenant_name || "—"}</TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
                      No audit log entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ─────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, count)} of {count}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
