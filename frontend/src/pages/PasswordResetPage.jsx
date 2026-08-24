import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/layout/AuthLayout";
import { authApi } from "@/services/api";
import {
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const CONFIRM_LABELS = {
  email: "Email",
  token: "Reset code",
  password: "New password",
  confirm: "Confirm new password",
};

export default function PasswordResetPage() {
  const [step, setStep] = useState("request");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const requestForm = useForm({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  });
  const confirmForm = useForm({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { email: "", token: "", password: "", confirm: "" },
  });

  const onRequest = async (values) => {
    setError("");
    try {
      await authApi.passwordResetRequest(values);
      setOk("If that email exists, a reset code was sent.");
      confirmForm.setValue("email", values.email);
      setStep("confirm");
    } catch {
      setError("Request failed");
    }
  };

  const onConfirm = async (values) => {
    setError("");
    try {
      await authApi.passwordResetConfirm({
        email: values.email,
        token: values.token,
        password: values.password,
      });
      setOk("Password updated. You can sign in.");
    } catch {
      setError("Reset failed");
    }
  };

  return (
    <AuthLayout
      title={step === "request" ? "Reset your password" : "Choose a new password"}
      subtitle={
        step === "request"
          ? "We'll email you a short-lived reset code. For privacy we always show the same confirmation."
          : "Enter the reset code from your email and pick a new password."
      }
      footer={
        <>
          Back to{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
          >
            sign in
          </Link>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      ) : null}

      {step === "request" ? (
        <Form {...requestForm}>
          <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-4">
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
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
              className="h-10 w-full font-medium shadow-sm"
            >
              Send reset code
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...confirmForm}>
          <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-4">
            {["email", "token", "password", "confirm"].map((name) => (
              <FormField
                key={name}
                control={confirmForm.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{CONFIRM_LABELS[name]}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10"
                        type={
                          name === "password" || name === "confirm"
                            ? "password"
                            : name === "token"
                              ? "text"
                              : "email"
                        }
                        autoComplete={name === "password" || name === "confirm" ? "new-password" : undefined}
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
              className="h-10 w-full font-medium shadow-sm"
            >
              Update password
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
