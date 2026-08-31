import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Search, UsersRound } from 'lucide-react';
import { useState } from 'react';

const ROLE_STYLES = {
  tenant_admin: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
  lecturer: 'bg-[var(--info-soft)] text-sky-700 dark:text-sky-300 border-sky-500/20',
  student: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/20',
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
  const { data, isLoading, error } = useQuery({
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

  return (
    <AppShell
      title="Users"
      description="Accounts in your institution — roles and activation status."
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-xs">Admin access required or request failed</AlertDescription>
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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="inline-flex rounded-lg border bg-card p-0.5">
            {['all', 'student', 'lecturer', 'tenant_admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
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
        <div className="overflow-hidden rounded-xl card-surface">
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
              {filtered.map((u) => (
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
              {filtered.length === 0 && (
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
    </AppShell>
  );
}

function StatTile({ label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-primary bg-primary/10',
    sky: 'text-[var(--info)] bg-[var(--info-soft)] ',
    violet: 'text-[var(--accent-strong)] bg-[var(--accent-soft)]',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-2.5">
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
        <UsersRound className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight">{value ?? 0}</p>
      </div>
    </div>
  );
}
