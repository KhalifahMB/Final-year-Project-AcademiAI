import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Loader2, Building2, CheckCircle2 } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import AvatarPicker from '@/components/shared/AvatarPicker';
import SearchableSelect from '@/components/shared/SearchableSelect';
import api, { authApi } from '@/services/api';
import { signupSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

export default function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [avatarPreset, setAvatarPreset] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      tenant_slug: '',
      role: 'student',
      faculty: '',
      department: '',
      programme: '',
      gender: '',
    },
  });

  const directory = useQuery({
    queryKey: ['tenant-directory'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/');
      return data.results || [];
    },
    staleTime: 5 * 60_000,
  });

  const chosenSlug = useWatch({ control: form.control, name: 'tenant_slug' });
  const chosenFaculty = useWatch({ control: form.control, name: 'faculty' });
  const chosenDepartment = useWatch({ control: form.control, name: 'department' });
  const watchedRole = useWatch({ control: form.control, name: 'role' });
  const isStudent = watchedRole !== 'lecturer';

  // Faculties for the chosen institution — first scoping level.
  const faculties = useQuery({
    queryKey: ['faculty-directory', chosenSlug],
    queryFn: async () => {
      if (!chosenSlug) return [];
      const { data } = await api.get('/faculty-directory/', {
        params: { tenant: chosenSlug },
      });
      return data.results || [];
    },
    enabled: !!chosenSlug,
    staleTime: 5 * 60_000,
  });
  const facultyOptions = (faculties.data || []).map((f) => ({
    value: f.id,
    label: f.code ? `${f.code} — ${f.name}` : f.name,
  }));
  const facultiesEmpty =
    faculties.isSuccess && (faculties.data || []).length === 0;

  // Departments scoped to the selected faculty. When the institution
  // exposes no faculties at all, fall back to the unscoped list so the
  // field never dead-ends.
  const departmentsEnabled =
    !!chosenSlug && (!!chosenFaculty || facultiesEmpty);
  const departments = useQuery({
    queryKey: ['department-directory', chosenSlug, chosenFaculty || 'all'],
    queryFn: async () => {
      if (!chosenSlug) return [];
      const params = { tenant: chosenSlug };
      if (chosenFaculty) params.faculty = chosenFaculty;
      const { data } = await api.get('/department-directory/', { params });
      return data.results || [];
    },
    enabled: departmentsEnabled,
    staleTime: 5 * 60_000,
  });
  const departmentOptions = (departments.data || []).map((d) => ({
    value: d.id,
    label: d.code ? `${d.code} — ${d.name}` : d.name,
    hint: d.faculty_name || undefined,
  }));
  const departmentsEmpty =
    departments.isSuccess && (departments.data || []).length === 0;

  // Programmes scoped to the selected department. When the institution
  // exposes no departments at all, fall back to the unscoped list so the
  // field never dead-ends.
  const programmesEnabled =
    !!chosenSlug && (!!chosenDepartment || departmentsEmpty);
  const programmes = useQuery({
    queryKey: ['programme-directory', chosenSlug, chosenDepartment || 'all'],
    queryFn: async () => {
      if (!chosenSlug) return [];
      const params = { tenant: chosenSlug };
      if (chosenDepartment) params.department = chosenDepartment;
      const { data } = await api.get('/programme-directory/', { params });
      return data.results || [];
    },
    enabled: programmesEnabled,
    staleTime: 5 * 60_000,
  });
  const programmeOptions = (programmes.data || []).map((p) => ({
    value: p.id,
    label: p.code ? `${p.code} — ${p.name}` : p.name,
    hint: p.department_name || undefined,
  }));

  const resetAcademicScope = () => {
    form.setValue('faculty', '');
    form.setValue('department', '');
    form.setValue('programme', '');
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      const payload = { ...values };
      // Faculty is UI-only scoping (profiles derive it via department /
      // programme) — never submitted.
      delete payload.faculty;
      // Role-scoped payload: students attach via programme (which implies
      // the department); lecturers attach via department; never send both.
      if (isStudent) {
        delete payload.department;
        if (!payload.programme) delete payload.programme;
      } else {
        delete payload.programme;
        if (!payload.department) delete payload.department;
      }
      let signupRes;
      if (avatarFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') fd.append(k, v);
        });
        fd.append('avatar', avatarFile);
        signupRes = await authApi.signup(fd);
      } else {
        if (avatarPreset) payload.avatar_preset = avatarPreset;
        signupRes = await authApi.signup(payload);
      }
      // Use the backend-normalized email so the verify-email page pre-fills
      // exactly what the account was created with.
      const emails = signupRes?.data?.user?.email || signupRes?.user?.email;
      navigate('/verify-email', { state: { email: emails || values.email } });
    } catch (err) {
      const d = err.response?.data?.error?.detail;
      setError(typeof d === 'string' ? d : JSON.stringify(d || 'Signup failed'));
    }
  };

  return (
    <AuthLayout
      icon={UserPlus}
      eyebrow="Join your institution"
      title="Create your account for free"
      subtitle="Join your institution's AcademiAI workspace in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="landing-text-link font-semibold"
          >
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" role="alert" className="mb-4 border-red-500/30 bg-[var(--danger-soft)] text-red-700 dark:text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            {['first_name', 'last_name'].map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-tight">
                      {name === 'first_name' ? 'First name' : 'Last name'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        placeholder={name === 'first_name' ? 'Ada' : 'Lovelace'}
                        autoComplete={name === 'first_name' ? 'given-name' : 'family-name'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold tracking-tight">Institutional email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    className="h-9"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold tracking-tight">Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    className="h-9"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="tenant_slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold tracking-tight">Institution</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value || ''}
                      onChange={(v) => {
                        field.onChange(v);
                        resetAcademicScope();
                      }}
                      onBlur={field.onBlur}
                      aria-label="Institution"
                      options={(directory.data || []).map((t) => ({
                        value: t.slug,
                        label: t.name,
                        hint: `/${t.slug}`,
                      }))}
                      loading={directory.isLoading}
                      placeholder={directory.isLoading ? 'Loading…' : 'Select'}
                      searchPlaceholder="Search institutions…"
                      emptyText="No institution matches that search."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold tracking-tight">I am a</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // Programme belongs to students only; department
                      // scoping is shared, so keep it and drop the programme.
                      form.setValue('programme', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full capitalize">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="lecturer">Lecturer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Admin access is granted by your institution.
                  </p>
                </FormItem>
              )}
            />
          </div>

          {/* Faculty → department → programme: each level scopes the next.
              Faculty itself is UI-only scoping; profiles derive it via the
              chosen department / programme. */}
          <FormField
            control={form.control}
            name="faculty"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[12px] font-medium">
                  Faculty (optional)
                </FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value || ''}
                    onChange={(v) => {
                      field.onChange(v);
                      form.setValue('department', '');
                      form.setValue('programme', '');
                    }}
                    onBlur={field.onBlur}
                    aria-label="Faculty"
                    options={facultyOptions}
                    loading={faculties.isLoading}
                    disabled={!chosenSlug || faculties.isLoading}
                    placeholder={
                      !chosenSlug
                        ? 'Choose an institution first'
                        : faculties.isLoading
                          ? 'Loading…'
                          : facultiesEmpty
                            ? 'No faculties listed'
                            : 'Select faculty'
                    }
                    searchPlaceholder="Search faculties…"
                    emptyText={
                      facultiesEmpty
                        ? 'This institution has not listed any faculties yet.'
                        : 'No faculty matches that search.'
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Department — required context for everyone: lecturers join it,
              students pick their programme inside it. */}
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[12px] font-medium">
                  Department{isStudent ? ' (optional)' : ''}
                </FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value || ''}
                    onChange={(v) => {
                      field.onChange(v);
                      form.setValue('programme', '');
                    }}
                    onBlur={field.onBlur}
                    aria-label="Department"
                    options={departmentOptions}
                    loading={departments.isLoading}
                    disabled={!departmentsEnabled || departments.isLoading}
                    placeholder={
                      !chosenSlug
                        ? 'Choose an institution first'
                        : !chosenFaculty && !facultiesEmpty
                          ? 'Choose a faculty first'
                          : departments.isLoading
                            ? 'Loading…'
                            : departmentsEmpty
                              ? 'No departments listed'
                              : 'Select department'
                    }
                    searchPlaceholder="Search departments…"
                    emptyText={
                      departmentsEmpty
                        ? 'This institution has not listed any departments yet.'
                        : 'No department matches that search.'
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isStudent ? (
            <FormField
              control={form.control}
              name="programme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium">Programme (optional)</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value || ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-label="Programme"
                      options={programmeOptions}
                      loading={programmes.isLoading}
                      disabled={!programmesEnabled || programmes.isLoading}
                      placeholder={
                        !chosenSlug
                          ? 'Choose an institution first'
                          : !chosenDepartment && !departmentsEmpty
                            ? 'Choose a department first'
                            : programmes.isLoading
                              ? 'Loading…'
                              : (programmes.data || []).length === 0
                                ? 'No programmes listed'
                                : 'Select programme'
                      }
                      searchPlaceholder="Search programmes…"
                      emptyText="No programme matches that search."
                    />
                  </FormControl>
                  <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" aria-hidden />
                    Programmes are scoped to your department, so you start with a
                    curated profile and can enrol in the right courses after
                    email verification.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" aria-hidden />
              Your department links you to the courses you teach after email
              verification.
            </p>
          )}

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[12px] font-medium">Gender (optional)</FormLabel>
                <Select value={field.value || 'unspecified'} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="unspecified">Prefer not to say</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div>
            <p className="mb-1.5 text-[12px] font-medium">Profile picture (optional)</p>
            <AvatarPicker
              presetId={avatarPreset}
              onPresetId={setAvatarPreset}
              file={avatarFile}
              preview={avatarPreview}
              onFile={(f) => {
                setAvatarFile(f);
                setAvatarPreview(f ? URL.createObjectURL(f) : null);
              }}
              onError={(m) => setError(m)}
            />
          </div>

          {directory.isSuccess && (directory.data || []).length === 0 && (
            <Alert>
              <Building2 className="h-3.5 w-3.5" />
              <AlertDescription className="text-[12px]">
                Your institution hasn't joined AcademiAI yet — an administrator can register
                it first, then you can sign up here.{' '}
                <Link to="/request-institution" className="landing-text-link font-medium">
                  Request it
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting || directory.isLoading}
            className="h-10 w-full gap-2 text-[14px] font-semibold"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create account
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            By creating an account you agree to AcademiAI's terms. You'll receive a 6-digit
            verification code by email.
          </p>
        </form>
      </Form>
    </AuthLayout>
  );
}
