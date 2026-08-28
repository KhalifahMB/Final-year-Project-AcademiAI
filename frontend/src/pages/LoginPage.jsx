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
      title="Welcome back"
      subtitle="Sign in to continue to your AcademiAI workspace."
      footer={
        <>
          New to AcademiAI?{' '}
          <Link
            to="/signup"
            className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
          >
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    className="text-[12px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
                  >
                    Forgot?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-10"
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
            className="h-10 w-full gap-2 text-[14px] font-semibold shadow-sm"
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
