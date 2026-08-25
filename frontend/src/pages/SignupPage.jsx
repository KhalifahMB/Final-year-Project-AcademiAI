import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '@/components/layout/AuthLayout';
import { authApi } from '@/services/api';
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

const FIELD_META = {
  first_name: {
    label: 'First name',
    placeholder: 'Ada',
    autoComplete: 'given-name',
  },
  last_name: {
    label: 'Last name',
    placeholder: 'Lovelace',
    autoComplete: 'family-name',
  },
  email: {
    label: 'Email',
    placeholder: 'you@university.edu',
    type: 'email',
    autoComplete: 'email',
  },
  password: {
    label: 'Password',
    placeholder: 'Minimum 8 characters',
    type: 'password',
    autoComplete: 'new-password',
  },
  tenant_slug: { label: 'Institution slug', placeholder: 'e.g. demo-uni' },
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      tenant_slug: 'demo-uni',
      role: 'student',
    },
  });

  const onSubmit = async (values) => {
    setError('');
    try {
      await authApi.signup(values);
      navigate('/verify-email');
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
                    <FormLabel>{FIELD_META[name].label}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10"
                        placeholder={FIELD_META[name].placeholder}
                        autoComplete={FIELD_META[name].autoComplete}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          {['email', 'password'].map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{FIELD_META[name].label}</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10"
                      type={FIELD_META[name].type || 'text'}
                      placeholder={FIELD_META[name].placeholder}
                      autoComplete={FIELD_META[name].autoComplete}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="tenant_slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution slug</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10"
                      placeholder={FIELD_META.tenant_slug.placeholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={() => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <div className="flex h-10 items-center rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                      Student
                    </div>
                  </FormControl>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Lecturer/admin access is granted by your institution's
                    admin.
                  </p>
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
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
