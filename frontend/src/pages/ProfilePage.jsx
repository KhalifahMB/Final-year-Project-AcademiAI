import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppShell from '@/components/layout/AppShell';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTheme } from '@/hooks/useTheme';
import AgentSettings from '@/components/agent/AgentSettings';
import AvatarPicker from '@/components/shared/AvatarPicker';
import Avatar from '@/components/shared/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { profileSchema, passwordChangeSchema } from '@/lib/validations';
import api, { platformApi, authApi } from '@/services/api';
import { getTenantInfo } from '@/lib/tenant';
import { toast } from 'sonner';import {
  Building2,
  Check,
  KeyRound,
  Loader2,
  Megaphone,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  GraduationCap,
  LayoutDashboard,
  LayoutTemplate,
  Users,
  BookOpen,
  ClipboardPlus,
  Upload,
  ArrowRight,
  LogOut,
  Mail,
} from 'lucide-react';

const GENDERS = [
  { value: 'unspecified', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const SECTIONS = [
  { id: 'profile', label: 'Profile', hint: 'Picture & personal details', icon: UserRound },
  { id: 'security', label: 'Account & security', hint: 'Email, password, sessions', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', hint: 'Theme', icon: Sun },
  { id: 'notifications', label: 'Notifications', hint: 'Email preferences', icon: Megaphone },
  { id: 'workspace', label: 'Workspace', hint: 'Institution & shortcuts', icon: LayoutDashboard },
];

function AppearanceCard() {
  const { dark, toggle } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sun className="h-4 w-4 text-primary" aria-hidden /> Appearance
        </CardTitle>
        <CardDescription>
          Choose how AcademiAI looks on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Theme">
          <button
            type="button"
            onClick={dark ? toggle : undefined}
            aria-pressed={!dark}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              !dark
                ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                : 'bg-card hover:bg-muted'
            }`}
          >
            <Sun className="h-4 w-4" aria-hidden />
            Light
          </button>
          <button
            type="button"
            onClick={dark ? undefined : toggle}
            aria-pressed={dark}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              dark
                ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                : 'bg-card hover:bg-muted'
            }`}
          >
            <Moon className="h-4 w-4" aria-hidden />
            Dark
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnouncementPreferencesCard() {
  const qc = useQueryClient();
  const prefsQ = useQuery({
    queryKey: ['announcement-preferences'],
    queryFn: async () =>
      (await platformApi.announcementSubscriptions.get()).data,
    staleTime: 30_000,
  });

  const savePrefs = useMutation({
    mutationFn: (payload) =>
      platformApi.announcementSubscriptions.update(payload),
    onSuccess: () => {
      toast.success('Announcement preferences saved');
      qc.setQueryData(['announcement-preferences'], (old) =>
        old ? { ...old, ...savePrefs.variables } : old,
      );
    },
    onError: () => toast.error('Could not save announcement preferences'),
  });

  const subscribedInfo = prefsQ.data?.subscribe_info !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-4 w-4 text-primary" aria-hidden />{' '}
          Announcements
        </CardTitle>
        <CardDescription>
          Choose which platform announcements are emailed to you. Important
          announcements (warnings and critical) are always sent and cannot be
          unsubscribed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="subscribe-info"
            checked={subscribedInfo}
            disabled={savePrefs.isPending}
            onCheckedChange={(v) =>
              savePrefs.mutate({ subscribe_info: v === true })
            }
          />
          <div className="space-y-1">
            <Label htmlFor="subscribe-info" className="text-sm font-medium">
              General announcements
            </Label>
            <p className="text-xs text-muted-foreground">
              Feature updates, tips, and routine notices (Info priority).
            </p>
          </div>
        </div>
        <p className="rounded-lg bg-[var(--warn-soft)] px-3 py-2.5 text-xs text-muted-foreground">
          Warnings and Critical announcements are always emailed to you and
          cannot be turned off.
        </p>
      </CardContent>
    </Card>
  );
}

function InstitutionCard({ user }) {
  const isAdmin = user?.role === 'tenant_admin';
  const tenantInfo = getTenantInfo(user);
  const enrolled = !!tenantInfo;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-4 w-4 text-primary" aria-hidden /> Institution
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'You manage this institution. Academic structure and enrollments live in your admin area.'
            : "Managed by your institution's administrators — read-only for you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Role</span>
          <Badge className="capitalize">{user?.role}</Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Institution</span>
          <span className="font-medium">
            {enrolled ? tenantInfo.name || 'Your institution' : 'Not enrolled in an institution'}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Email verified</span>
          <Badge variant={user?.is_email_verified ? 'default' : 'secondary'}>
            {user?.is_email_verified ? 'Verified' : 'Not verified'}
          </Badge>
        </div>
        {!isAdmin && (
          <>
            <Separator />
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Programme, department and enrollment details are maintained by
              your institution. Contact your administrator to correct them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function useAcademicProfile(user) {
  const programmeId = user?.role === 'student' ? user?.programme_id : null;
  const departmentId = user?.department_id || null;
  const programmeQ = useQuery({
    queryKey: ['academic-profile-programme', programmeId],
    queryFn: async () => (await api.get(`/programmes/${programmeId}/`)).data,
    enabled: !!programmeId,
    staleTime: 5 * 60_000,
  });
  const departmentQ = useQuery({
    queryKey: ['academic-profile-department', departmentId],
    queryFn: async () => (await api.get(`/departments/${departmentId}/`)).data,
    enabled: !!departmentId,
    staleTime: 5 * 60_000,
  });
  const facultyId = departmentQ.data?.faculty || null;
  const facultyQ = useQuery({
    queryKey: ['academic-profile-faculty', facultyId],
    queryFn: async () => (await api.get(`/faculties/${facultyId}/`)).data,
    enabled: !!facultyId,
    staleTime: 5 * 60_000,
  });
  return {
    programme: programmeQ.data || null,
    department: departmentQ.data || null,
    faculty: facultyQ.data || null,
    loading: programmeQ.isLoading || departmentQ.isLoading || facultyQ.isLoading,
  };
}

function AcademicCard({ user }) {
  const { programme, department, faculty, loading } = useAcademicProfile(user);
  const isStudent = user?.role === 'student';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden /> Academic profile
        </CardTitle>
        <CardDescription>
          {isStudent
            ? 'Your programme, department and faculty — maintained by your institution.'
            : 'Your home department — maintained by your institution.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-9 rounded-md" />
            ))}
          </div>
        ) : (
          <>
            {isStudent && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Programme</span>
                <span className="font-medium">
                  {programme
                    ? `${programme.code ? `${programme.code} — ` : ''}${programme.name}`
                    : 'Not attached yet'}
                </span>
              </div>
            )}
            {isStudent && <Separator />}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium">{department?.name || '—'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Faculty</span>
              <span className="font-medium">{faculty?.name || '—'}</span>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-1 h-8 gap-1.5 text-xs">
              <Link to={isStudent ? '/my-programme' : '/assigned-courses'}>
                {isStudent ? 'View my programme' : 'View my courses'}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const WORKSPACE_LINKS = {
  student: [
    { to: '/my-courses', label: 'My courses', desc: 'Enrollments this session', icon: BookOpen },
    { to: '/my-programme', label: 'My programme', desc: 'Academic profile', icon: GraduationCap },
    { to: '/progress', label: 'My progress', desc: 'Concept mastery', icon: Check },
  ],
  lecturer: [
    { to: '/assigned-courses', label: 'My courses', desc: 'Offerings you teach', icon: BookOpen },
    { to: '/admin/quizzes', label: 'Quiz manager', desc: 'Author assessments', icon: ClipboardPlus },
    { to: '/resources/upload', label: 'Upload material', desc: 'Share resources', icon: Upload },
  ],
  tenant_admin: [
    { to: '/admin/dashboard', label: 'Institution dashboard', desc: 'Users & activity', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Manage users', desc: 'Roles & access', icon: Users },
    { to: '/admin/tenant', label: 'Institution structure', desc: 'Faculties & calendar', icon: Building2 },
    { to: '/admin/templates', label: 'Plan templates', desc: 'Reusable study plans', icon: LayoutTemplate },
  ],
};

const PLATFORM_LINKS = [
  { to: '/platform', label: 'Platform console', desc: 'Overview & stats', icon: LayoutDashboard },
  { to: '/platform/requests', label: 'Institution requests', desc: 'Review onboarding', icon: Check },
  { to: '/platform/announcements', label: 'Announcements', desc: 'Broadcast updates', icon: Megaphone },
];

function WorkspaceShortcutsCard({ user }) {
  const links = user?.is_superuser
    ? PLATFORM_LINKS
    : WORKSPACE_LINKS[user?.role] || WORKSPACE_LINKS.student;
  const title = user?.is_superuser ? 'Platform shortcuts' : 'Workspace shortcuts';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutDashboard className="h-4 w-4 text-primary" aria-hidden /> {title}
        </CardTitle>
        <CardDescription>
          {user?.is_superuser
            ? 'Jump to the platform areas you manage.'
            : 'Jump to the areas you use most.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-3">
          {links.map(({ to, label, desc, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{desc}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SecuritySessionCard() {
  const { logout } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Sessions
        </CardTitle>
        <CardDescription>
          You are signed in on this device. Signing out ends this session immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out of this device
        </Button>
      </CardContent>
    </Card>
  );
}

function EmailStatusCard({ user }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-4 w-4 text-primary" aria-hidden /> Email address
        </CardTitle>
        <CardDescription>
          Used for sign-in, verification and notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user?.email || '—'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {user?.is_email_verified
              ? 'Verified. Changing it below (Personal information) resets verification and sends a new code.'
              : 'Not verified yet — check your inbox for the 6-digit code.'}
          </p>
        </div>
        <Badge variant={user?.is_email_verified ? 'default' : 'secondary'}>
          {user?.is_email_verified ? 'Verified' : 'Not verified'}
        </Badge>
      </CardContent>
    </Card>
  );
}

function ProfileHeader({ user }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-[var(--accent)] p-6 text-white sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-white/10 blur-xl"
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <Avatar
          user={user}
          className="h-20 w-20 border-2 border-white/40 sm:h-24 sm:w-24"
        />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {[user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
              user?.email}
          </h2>
          <p className="mt-0.5 truncate text-sm text-white/80">{user?.email}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium capitalize backdrop-blur">
              {user?.is_superuser ? 'Platform Operator' : user?.role}
            </span>
            {user?.is_email_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--success)] backdrop-blur">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const qc = useQueryClient();
  const [profileError, setProfileError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [presetId, setPresetId] = useState(user?.avatar_preset || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [prevPreset, setPrevPreset] = useState(user?.avatar_preset);

  if (user?.avatar_preset !== prevPreset) {
    setPrevPreset(user?.avatar_preset);
    setPresetId(user?.avatar_preset || '');
  }

  const onPickFile = (f) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const saveAvatarMutation = useMutation({
    mutationFn: async () => {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post('/auth/me/avatar/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        await api.patch('/auth/me/', { avatar_preset: '' });
      } else if (presetId !== (user?.avatar_preset || '')) {
        await api.patch('/auth/me/', { avatar_preset: presetId });
        await api.delete('/auth/me/avatar/');
      }
    },
    onSuccess: async () => {
      toast.success('Profile picture updated');
      qc.removeQueries({ queryKey: ['avatar-url'] });
      setFile(null);
      setPreview(null);
      if (reload) await reload();
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.error?.detail || 'Could not update picture',
      );
    },
  });

  // --- Personal info -------------------------------------------------
  const form = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone_number: user?.phone_number || '',
      gender: user?.gender || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (values) => authApi.updateMe(values),
    onSuccess: async () => {
      toast.success('Profile updated');
      qc.removeQueries({ queryKey: ['avatar-url'] });
      setProfileError('');
      if (reload) await reload();
    },
    onError: (err) => {
      const d = err.response?.data;
      const detail =
        d?.error?.detail ||
        (typeof d === 'object' ? Object.values(d).flat().join(' ') : '') ||
        'Update failed';
      setProfileError(String(detail));
    },
  });

  const onSaveProfile = (values) => {
    updateProfileMutation.mutate(values);
  };

  // --- Password -------------------------------------------------------
  const pwForm = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { old_password: '', new_password: '', confirm: '' },
  });
  const [pwError, setPwError] = useState('');

  const onSubmitPassword = async (values) => {
    setPwError('');
    try {
      await authApi.passwordChange({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success('Password updated');
      pwForm.reset();
    } catch (err) {
      setPwError(err.response?.data?.error?.detail || 'Password change failed');
    }
  };

  const isSuper = !!user?.is_superuser;
  const showAcademic = !isSuper && (user?.role === 'student' || user?.role === 'lecturer');

  // Section navigation (?section= deep-linkable, Linear/Vercel-style).
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section');
  const [section, setSection] = useState(
    SECTIONS.some((s) => s.id === initialSection) ? initialSection : 'profile',
  );
  const pickSection = (id) => {
    setSection(id);
    setSearchParams(id === 'profile' ? {} : { section: id }, { replace: true });
  };
  const activeSection = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <AppShell
      title="Settings"
      description="Profile, security, appearance, notifications and workspace — one section at a time."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <ProfileHeader user={user} />

        {/* Mobile section nav — horizontal chips */}
        <nav aria-label="Settings sections" className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSection(s.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Desktop section nav — sticky sidebar */}
          <nav aria-label="Settings sections" className="sticky top-20 hidden lg:block">
            <ul className="space-y-1 rounded-xl border bg-card p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pickSection(s.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{s.label}</span>
                        <span className="block truncate text-[11px] opacity-80">{s.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0">
            <h2 className="mb-1 text-lg font-semibold tracking-tight">{activeSection.label}</h2>
            <p className="mb-5 text-[13px] text-muted-foreground">{activeSection.hint}</p>

        {section === 'profile' && (
          <div className="max-w-2xl space-y-6">
        {/* Profile picture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile picture</CardTitle>
            <CardDescription>
              Shown next to your name across AcademiAI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {avatarError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{avatarError}</AlertDescription>
              </Alert>
            )}
            <AvatarPicker
              presetId={presetId}
              onPresetId={setPresetId}
              file={file}
              preview={preview}
              onFile={onPickFile}
              onError={setAvatarError}
            />
            <Button
              type="button"
              size="sm"
              disabled={
                saveAvatarMutation.isPending ||
                (!file && presetId === (user?.avatar_preset || ''))
              }
              onClick={() => saveAvatarMutation.mutate()}
            >
              {saveAvatarMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="mr-2 h-4 w-4" aria-hidden />
              )}
              {saveAvatarMutation.isPending ? 'Saving…' : 'Save picture'}
            </Button>
          </CardContent>
        </Card>

        {/* Personal info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-4 w-4 text-primary" aria-hidden />{' '}
                Personal information
              </CardTitle>
              <CardDescription>Your private account details.</CardDescription>
            </CardHeader>
            <CardContent>
              {profileError && (
                <Alert variant="destructive" role="alert" className="mb-3">
                  <AlertDescription>{String(profileError)}</AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSaveProfile)}
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <p className="text-[11px] text-muted-foreground">
                          Changing your email resets verification — a new 6-digit code will be sent.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+234 800 000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select
                          value={field.value || 'unspecified'}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDERS.map((g) => (
                              <SelectItem key={g.value} value={g.value}>
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden
                        />
                        Saving…
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          </div>
        )}

        {section === 'security' && (
          <div className="max-w-2xl space-y-6">
            <EmailStatusCard user={user} />
            {/* Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-4 w-4 text-primary" aria-hidden />{' '}
                  Change password
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pwError && (
                  <Alert variant="destructive" role="alert" className="mb-3">
                    <AlertDescription>{String(pwError)}</AlertDescription>
                  </Alert>
                )}
                <Form {...pwForm}>
                  <form
                    onSubmit={pwForm.handleSubmit(onSubmitPassword)}
                    className="space-y-3"
                  >
                    {['old_password', 'new_password', 'confirm'].map((name) => (
                      <FormField
                        key={name}
                        control={pwForm.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {name === 'old_password'
                                ? 'Current password'
                                : name === 'new_password'
                                  ? 'New password'
                                  : 'Confirm new password'}
                            </FormLabel>
                            <FormControl>
                              <PasswordInput
                                autoComplete={
                                  name === 'old_password'
                                    ? 'current-password'
                                    : 'new-password'
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <Button
                      type="submit"
                      disabled={pwForm.formState.isSubmitting}
                    >
                      Update password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <SecuritySessionCard />
          </div>
        )}

        {section === 'appearance' && (
          <div className="max-w-2xl space-y-6">
            <AppearanceCard />
          </div>
        )}

        {section === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <AnnouncementPreferencesCard />
          </div>
        )}

        {section === 'workspace' && (
          <div className="max-w-2xl space-y-6">
            <WorkspaceShortcutsCard user={user} />
            {(user?.tenant || user?.tenant_detail) && !isSuper ? <InstitutionCard user={user} /> : null}
            {showAcademic ? <AcademicCard user={user} /> : null}
            <AgentSettings />
          </div>
        )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
