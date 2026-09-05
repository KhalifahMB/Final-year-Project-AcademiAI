import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import StatTile from '@/components/shared/StatTile';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Search, UsersRound } from 'lucide-react';
import { useState } from 'react';

const PAGE_SIZE = 10;

const ROLE_STYLES = {
  tenant_admin: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/20',
  lecturer: 'bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/20',
  student: 'bg-[var(--surface-2)] text-[var(--fg-soft)] border-[var(--border)]',
};

const ROLE_LABELS = {
  student: 'Student',
  lecturer: 'Lecturer',
  tenant_admin: 'Tenant Admin',
};

function RoleBadge({ role }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
      ROLE_STYLES[role] || 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]',
    )}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users/');
      return data.results || data;
    },
    select: (data) => data || [],
  });
  // React Query's `select` is not applied at the first render (data is
  // undefined), so fall back to a stable empty array.
  const users = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.email || '').toLowerCase().includes(q) ||
        ((u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AppShell
      title="Users"
      description="Accounts in your institution — roles and activation status."
    >
      {error ? (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Admin access required or request failed{error?.response?.data?.detail ? `: ${error.response.data.detail}` : ''}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Stats */}
      {!isLoading && users.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label="Total users" value={users.length} tone="indigo" />
          <StatTile label="Students" value={users.filter((u) => u.role === 'student').length} tone="indigo" />
          <StatTile label="Lecturers" value={users.filter((u) => u.role === 'lecturer').length} tone="sky" />
          <StatTile label="Admins" value={users.filter((u) => u.role === 'tenant_admin').length} tone="violet" />
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && users.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users…" aria-label="Search users by name or email" className="h-8 pl-8 text-xs" />
          </div>
          <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Filter by role">
            {['all', 'student', 'lecturer', 'tenant_admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRoleFilter(r); setPage(1); }}
                aria-pressed={roleFilter === r}
                className={cn(
                  'h-7 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                  roleFilter === r ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {r === 'all' ? 'All' : (ROLE_LABELS[r] || r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-11 rounded-lg" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No users yet"
          description="Users appear here once they sign up with your institution slug."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl card-surface">
          <Table>
            <TableHeader>
              <TableRow className="h-9 bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4 text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Role</TableHead>
                <TableHead className="pr-4 text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((u) => (
                <TableRow key={u.id} className="h-11">
                  <TableCell className="py-2 pl-4 text-sm font-medium">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell className="pr-4">
                    <StatusBadge status={u.is_active ? 'active' : 'archived'} />
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                    No users match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && users.length > 0 && filtered.length > PAGE_SIZE && (
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      )}
    </AppShell>
  );
}
