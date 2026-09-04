import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
 Building2,
 CheckCircle2,
 GraduationCap,
 Mail,
 User as UserIcon,
 Search,
 ShieldCheck,
} from 'lucide-react';

export default function MyProgrammePage() {
 const { user } = useAuth();
 const [search, setSearch] = useState('');
 const programmes = useQuery({
 queryKey: ['programmes'],
 queryFn: async () => {
 const { data } = await api.get('/programmes/');
 return data.results || data;
 },
 });

 const myProgrammeId = user?.programme_id || null;
 const filtered = useMemo(() => {
 const list = programmes.data || [];
 const q = search.trim().toLowerCase();
 const ranked = q
 ? list.filter(
 (p) =>
 (p.name || '').toLowerCase().includes(q) ||
 (p.code || '').toLowerCase().includes(q),
 )
 : list;
 // The student's own programme always floats to the top.
 return [...ranked].sort((a, b) => {
 const aMine = myProgrammeId && String(a.id) === String(myProgrammeId) ? 0 : 1;
 const bMine = myProgrammeId && String(b.id) === String(myProgrammeId) ? 0 : 1;
 return aMine - bMine;
 });
 }, [programmes.data, search, myProgrammeId]);

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
 <div className="rounded-xl border bg-card p-5">
 <div className="mb-4 flex items-center gap-2">
 <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
 <UserIcon className="h-4 w-4" aria-hidden />
 </span>
 <h3 className="text-sm font-semibold">Student identity</h3>
 </div>
 <dl className="space-y-2.5 text-[13px]">
 <Row icon={Mail} label="Email" value={user?.email || '—'} />
 <Row icon={UserIcon} label="Name" value={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—'} />
 <Row
 icon={ShieldCheck}
 label="Role"
 value={
 <Badge className="capitalize">{user?.role || '—'}</Badge>
 }
 />
 <Row
 icon={CheckCircle2}
 label="Verified"
 value={
 <span className={cn(
 'inline-flex items-center gap-1 text-xs font-medium',
 user?.is_email_verified
 ? 'text-[var(--success)] '
 : 'text-[var(--warn)]',
 )}>
 {user?.is_email_verified ? 'Verified' : 'Not verified'}
 </span>
 }
 />
 </dl>
 </div>

 {/* Programmes card */}
 <div className="rounded-xl border bg-card p-5">
 <div className="mb-4 flex items-center gap-2">
 <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
 <GraduationCap className="h-4 w-4" aria-hidden />
 </span>
 <div className="min-w-0">
 <h3 className="text-sm font-semibold">Programmes in your institution</h3>
 <p className="text-[11px] text-muted-foreground">Contact an admin to attach your profile to a programme.</p>
 </div>
 </div>
 <div className="relative mb-2">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
 <Input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search programmes…"
 aria-label="Search programmes by name or code"
 className="h-9 pl-8 text-sm"
 />
 </div>
 {programmes.isLoading ? (
 <div className="space-y-2">
 {[0, 1, 2].map((i) => <div key={i} className="skeleton h-8 rounded-md" />)}
 </div>
 ) : programmes.isError ? (
 <Alert variant="destructive">
 <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
 <span>Could not load programmes.</span>
 <Button type="button" variant="outline" size="sm" onClick={() => programmes.refetch()} className="h-7 shrink-0 text-[11px]">
 Retry
 </Button>
 </AlertDescription>
 </Alert>
 ) : (
 <ul className="divide-y">
 {filtered.map((p) => {
 const mine = myProgrammeId && String(p.id) === String(myProgrammeId);
 return (
 <li key={p.id} className={cn('flex items-center justify-between gap-3 py-2.5 text-[13px]', mine && 'rounded-md bg-[var(--accent-soft)]/50 px-2')}>
 <span className="flex min-w-0 items-center gap-2">
 <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
 <span className="truncate font-medium">{p.name}</span>
 {mine && (
 <Badge className="shrink-0 border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]">
 Yours
 </Badge>
 )}
 </span>
 <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
 {p.code}
 </span>
 </li>
 );
 })}
 {filtered.length === 0 && (
 <p className="py-4 text-center text-xs text-muted-foreground">
 {search.trim() ? 'No programmes match that search.' : 'No programmes configured yet.'}
 </p>
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
