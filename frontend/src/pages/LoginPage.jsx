import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setError('');
    try {
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      const d =
        err.response?.data?.error?.detail ||
        err.response?.data?.detail ||
        'Login failed';
      setError(typeof d === 'string' ? d : 'Invalid credentials');
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      eyebrow="Sign in to your workspace"
      title="Welcome back"
      subtitle="Sign in to continue to your AcademiAI workspace."
      footer={
        <>
          New to AcademiAI?{' '}
          <Link
            to="/signup"
            className="landing-text-link font-semibold"
          >
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[12px] font-medium">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@university.edu"
                    className="h-10"
                    data-testid="login-email"
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
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[12px] font-medium">Password</FormLabel>
                  <Link
                    to="/password-reset"
                    className="landing-text-link text-[12px] font-medium"
                  >
                    Forgot?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-10"
                    data-testid="login-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground select-none">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
            Keep me signed in
          </label>

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-10 w-full gap-2 text-[14px] font-semibold"
            data-testid="login-submit"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign in
              </>
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
