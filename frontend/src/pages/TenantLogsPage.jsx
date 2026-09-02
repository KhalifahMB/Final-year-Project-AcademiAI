import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Bug, Filter, Info, Loader2, Search, Shield,
} from 'lucide-react';

const LEVELS = [
  { value: '', label: 'All levels' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'chat', label: 'Chat' },
  { value: 'api', label: 'API' },
  { value: 'system', label: 'System' },
  { value: 'resource', label: 'Resource' },
  { value: 'agent', label: 'Agent' },
];

const levelConfig = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  error: { icon: Bug, color: 'text-red-500', bg: 'bg-red-500/10' },
};

export default function TenantLogsPage() {
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-logs', level, category, search, page],
    queryFn: async () => {
      const params = { page, page_size: 50 };
      if (level) params.level = level;
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await api.get('/logs/', { params });
      return data;
    },
    staleTime: 10000,
  });

  const logs = data?.results || data || [];
  const count = data?.count || logs.length;

  return (
    <AppShell title="Tenant Logs" description="Monitor system activity and API access for your institution.">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search logs…"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">{count} entries</span>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No logs found"
          description="No log entries match your current filters."
        />
      ) : (
        <div className="space-y-1">
          {logs.map((log) => {
            const cfg = levelConfig[log.level] || levelConfig.info;
            const Icon = cfg.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/30"
              >
                <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', cfg.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{log.action}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                      {log.category}
                    </span>
                    {log.response_status_code && (
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        log.response_status_code >= 500 ? 'bg-red-500/10 text-red-500' :
                        log.response_status_code >= 400 ? 'bg-amber-500/10 text-amber-500' :
                        'bg-green-500/10 text-green-500'
                      )}>
                        {log.response_status_code}
                      </span>
                    )}
                    {log.response_time_ms != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {log.response_time_ms}ms
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    {log.actor_email && <span>{log.actor_email}</span>}
                    {log.ip_address && <span>{log.ip_address}</span>}
                    <span title={log.timestamp}>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {count > 50 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={logs.length < 50}
            className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </AppShell>
  );
}
