import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HardDrive, Search, ChevronRight } from "lucide-react";

const toList = (d) => d?.results || d || [];

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${bytes} B`;
}

function PlanBadge({ plan }) {
  const colour =
    plan === "enterprise"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
      : plan === "pro"
      ? "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${colour}`}>
      {plan || "standard"}
    </span>
  );
}

const PLAN_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "pending", label: "Pending" },
];

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => toList((await platformApi.tenants.list({ page_size: 500 })).data),
    staleTime: 30_000,
  });

  const visibleTenants = useMemo(() => {
    let list = tenantsQ.data || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus);
    if (filterPlan !== "all") list = list.filter((t) => (t.plan || "standard") === filterPlan);
    return list;
  }, [tenantsQ.data, search, filterStatus, filterPlan]);

  return (
    <AppShell
      title="Tenants"
      description="Manage all institutions on the platform — monitor status and lifecycle."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search institutions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All plans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {PLAN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {tenantsQ.error ? (
        <Alert variant="destructive"><AlertDescription>Failed to load institutions — superuser access required.</AlertDescription></Alert>
      ) : tenantsQ.isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="overflow-hidden rounded-xl card-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Institution</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-3.5 font-medium">
                    <div>
                      <p>{t.name}</p>
                      {t.domain && <p className="text-xs text-muted-foreground">{t.domain}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                  <TableCell><PlanBadge plan={t.plan} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" aria-hidden />
                      {formatBytes(t.storage_quota_bytes)}
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell>
                    <Link to={`/platform/tenants/${t.id}`}>
                      <Button type="button" variant="ghost" size="icon" aria-label={`View ${t.name}`}>
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {visibleTenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {search || filterStatus !== "all" || filterPlan !== "all"
                      ? "No institutions match your filters."
                      : "No institutions yet. Institutions are added when you approve a sign-up request."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
