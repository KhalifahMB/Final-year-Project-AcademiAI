import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Loader2, Building2, CheckCircle2 } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import AvatarPicker from '@/components/shared/AvatarPicker';
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
  const watchedRole = useWatch({ control: form.control, name: 'role' });
  const programmes = useQuery({
    queryKey: ['programme-directory', chosenSlug],
    queryFn: async () => {
      if (!chosenSlug) return [];
      const { data } = await api.get('/programme-directory/', {
        params: { tenant: chosenSlug },
      });
      return data.results || [];
    },
    enabled: !!chosenSlug,
  });

  const onSubmit = async (values) => {
    setError('');
    try {
      const payload = { ...values };
      if (!payload.programme) delete payload.programme;
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
      title="Create your account for free"
      subtitle="Join your institution's AcademiAI workspace in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4 border-red-500/30 bg-[var(--danger-soft)] text-red-700 dark:text-red-400">
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
                    <FormLabel className="text-[12px] font-medium">
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
                <FormLabel className="text-[12px] font-medium">Institutional email</FormLabel>
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
                <FormLabel className="text-[12px] font-medium">Password</FormLabel>
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

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="tenant_slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium">Institution</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('programme', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue
                          placeholder={directory.isLoading ? 'Loading…' : 'Select'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(directory.data || []).map((t) => (
                        <SelectItem key={t.id} value={t.slug}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium">I am a</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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

          {watchedRole === 'student' && (
            <FormField
              control={form.control}
              name="programme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium">Programme (optional)</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue
                          placeholder={
                            !chosenSlug
                              ? 'Choose an institution first'
                              : programmes.isLoading
                                ? 'Loading…'
                                : (programmes.data || []).length === 0
                                  ? 'No programmes listed'
                                  : 'Select programme'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(programmes.data || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code ? `${p.code} — ${p.name}` : p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" aria-hidden />
                    Your programme starts a curated profile so you can browse and enrol in your
                    department's courses after email verification.
                  </p>
                </FormItem>
              )}
            />
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
                <Link to="/request-institution" className="font-medium text-primary underline">
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
