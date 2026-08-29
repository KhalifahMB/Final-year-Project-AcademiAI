import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import { authApi } from '@/services/api';
import {
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from '@/lib/validations';
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

const CONFIRM_LABELS = {
  email: 'Email',
  token: 'Reset code',
  password: 'New password',
  confirm: 'Confirm new password',
};

export default function PasswordResetPage() {
  const [step, setStep] = useState('request');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const requestForm = useForm({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });
  const confirmForm = useForm({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { email: '', token: '', password: '', confirm: '' },
  });

  const onRequest = async (values) => {
    setError('');
    setOk('');
    try {
      await authApi.passwordResetRequest(values);
      setOk('If that email exists, a reset code was sent.');
      confirmForm.setValue('email', values.email);
      setStep('confirm');
    } catch {
      setError('Request failed. Please try again.');
    }
  };

  const onConfirm = async (values) => {
    setError('');
    setOk('');
    try {
      await authApi.passwordResetConfirm({
        email: values.email,
        token: values.token,
        password: values.password,
      });
      setOk('Password updated. You can now sign in.');
    } catch {
      setError('Reset failed. The code may be expired or invalid.');
    }
  };

  const success = step === 'confirm' && ok.startsWith('Password updated');

  return (
    <AuthLayout
      icon={KeyRound}
      title={success ? 'Password updated' : step === 'request' ? 'Reset your password' : 'Choose a new password'}
      subtitle={
        success
          ? 'Your password has been changed successfully.'
          : step === 'request'
            ? "Enter your institutional email and we'll send you a short-lived reset code."
            : 'Enter the 6-digit code from your email and pick a new password.'
      }
      footer={
        <>
          Remembered it?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4 border-red-500/30 bg-[var(--danger-soft)] text-red-700 dark:text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {ok && (
        <Alert className="mb-4 border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)] ">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      )}

      {success ? (
        <Button asChild className="h-10 w-full gap-2 font-semibold">
          <Link to="/login">
            <ArrowLeft className="h-4 w-4" />
            Go to sign in
          </Link>
        </Button>
      ) : step === 'request' ? (
        <Form {...requestForm}>
          <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-4">
            <FormField
              control={requestForm.control}
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
            <Button
              type="submit"
              disabled={requestForm.formState.isSubmitting}
              className="h-10 w-full gap-2 font-semibold shadow-sm"
            >
              {requestForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Send reset code
                </>
              )}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...confirmForm}>
          <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-3.5">
            {['email', 'token', 'password', 'confirm'].map((name) => (
              <FormField
                key={name}
                control={confirmForm.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px] font-medium">{CONFIRM_LABELS[name]}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10"
                        type={
                          name === 'password' || name === 'confirm'
                            ? 'password'
                            : name === 'token'
                              ? 'text'
                              : 'email'
                        }
                        autoComplete={name === 'password' || name === 'confirm' ? 'new-password' : undefined}
                        placeholder={name === 'token' ? '6-digit code' : undefined}
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
              disabled={confirmForm.formState.isSubmitting}
              className="h-10 w-full gap-2 font-semibold shadow-sm"
            >
              {confirmForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setOk('');
                setError('');
              }}
              className="w-full text-[12px] text-muted-foreground hover:text-foreground"
            >
              Use a different email
            </button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
