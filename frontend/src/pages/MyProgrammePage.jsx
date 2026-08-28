import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/shared/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Mail,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';

export default function MyProgrammePage() {
  const { user } = useAuth();
  const programmes = useQuery({
    queryKey: ['programmes'],
    queryFn: async () => {
      const { data } = await api.get('/programmes/');
      return data.results || data;
    },
  });

  return (
    <AppShell
      title="My programme"
      description="Your student profile and the academic structure of your institution."
    >
      {!user ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-xs">Could not load profile</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Identity card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-primary">
              <UserIcon className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold">Student identity</h3>
          </div>
          <dl className="space-y-2.5 text-[13px]">
            <Row icon={Mail} label="Email" value={user?.email || '—'} />
            <Row icon={UserIcon} label="Name" value={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—'} />
            <Row icon={ShieldCheck} label="Role" value={
              <span className="capitalize">
                <StatusBadge status={user?.role === 'student' ? 'enrolled' : user?.role} />
              </span>
            } />
            <Row
              icon={CheckCircle2}
              label="Verified"
              value={
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  user?.is_email_verified
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400',
                )}>
                  {user?.is_email_verified ? 'Verified' : 'Not verified'}
                </span>
              }
            />
          </dl>
        </div>

        {/* Programmes card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-primary">
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Programmes in your institution</h3>
              <p className="text-[11px] text-muted-foreground">Contact an admin to attach your profile to a programme.</p>
            </div>
          </div>
          {programmes.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-8 rounded-md" />)}
            </div>
          ) : (
            <ul className="divide-y">
              {(programmes.data || []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium">{p.name}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {p.code}
                  </span>
                </li>
              ))}
              {(programmes.data || []).length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No programmes configured yet.</p>
              )}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden /> {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-medium">{value}</dd>
    </div>
  );
}
