import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import AuthLayout from '@/components/layout/AuthLayout';
import AvatarPicker from '@/components/shared/AvatarPicker';
import api, { authApi } from '@/services/api';
import { signupSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  // Public directory of active institutions — replaces typing a raw slug.
  const directory = useQuery({
    queryKey: ['tenant-directory'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/');
      return data.results || [];
    },
    staleTime: 5 * 60_000,
  });

  // Programmes of the chosen institution — drives the academic profile and
  // auto-enrollment into departmental courses after verification.
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
      if (avatarFile) {
        // Multipart so the profile picture travels with the signup request.
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') fd.append(k, v);
        });
        fd.append('avatar', avatarFile);
        await authApi.signup(fd);
      } else {
        if (avatarPreset) payload.avatar_preset = avatarPreset;
        await authApi.signup(payload);
      }
      navigate('/verify-email', { state: { email: values.email } });
    } catch (err) {
      const d = err.response?.data?.error?.detail;
      setError(
        typeof d === 'string' ? d : JSON.stringify(d || 'Signup failed'),
      );
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join your institution's AcademiAI workspace"
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
          >
            Sign in
          </Link>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['first_name', 'last_name'].map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{name === 'first_name' ? 'First name' : 'Last name'}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10"
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
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    className="h-10"
                    type="email"
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    className="h-10"
                    type="password"
                    placeholder="Minimum 8 characters"
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
                  <FormLabel>Institution</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('programme', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue
                          placeholder={
                            directory.isLoading ? 'Loading…' : 'Select institution'
                          }
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
                  <FormLabel>I am a</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full capitalize">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="student" className="capitalize">Student</SelectItem>
                      <SelectItem value="lecturer" className="capitalize">Lecturer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Admin access is granted by your institution's admin.
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
                  <FormLabel>Programme (optional)</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full">
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
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Picking your programme auto-enrolls you in your
                    department's courses once your email is verified.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select value={field.value || 'unspecified'} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-10 w-full">
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
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <p className="mb-2 text-sm font-medium">Profile picture</p>
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
              <AlertDescription>
                Your institution hasn't joined AcademiAI yet — an administrator
                can register it first, then you can sign up here.
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting || directory.isLoading}
            className="h-10 w-full font-medium shadow-sm"
          >
            {form.formState.isSubmitting
              ? 'Creating account…'
              : 'Create account'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You'll receive a verification code by email before you can sign in.
          </p>
        </form>
      </Form>
    </AuthLayout>
  );
}
