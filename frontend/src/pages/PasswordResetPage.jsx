import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authApi } from "@/services/api";
import {
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

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
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {ok && (
            <Alert className="mb-3">
              <AlertDescription>{ok}</AlertDescription>
            </Alert>
          )}
          {step === "request" ? (
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-3">
                <FormField
                  control={requestForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  Send reset code
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...confirmForm}>
              <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-3">
                {["email", "token", "password", "confirm"].map((name) => (
                  <FormField
                    key={name}
                    control={confirmForm.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {name === "token"
                            ? "Code"
                            : name === "confirm"
                              ? "Confirm password"
                              : name}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type={name.includes("password") || name === "confirm" ? "password" : "text"}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button type="submit" className="w-full">
                  Update password
                </Button>
              </form>
            </Form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
