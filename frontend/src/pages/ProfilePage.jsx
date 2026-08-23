import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { passwordChangeSchema } from "@/lib/validations";
import { authApi } from "@/services/api";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });

  const onSubmit = async (values) => {
    setError("");
    try {
      await authApi.passwordChange({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("Password updated");
      form.reset();
      if (reload) reload();
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Password change failed");
    }
  };

  return (
    <AppShell title="Profile">
      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span> {user?.email}
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "—"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Role:</span>
              <Badge>{user?.role}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Email verified:</span>
              <Badge variant={user?.is_email_verified ? "default" : "secondary"}>
                {user?.is_email_verified ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{String(error)}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {["old_password", "new_password", "confirm"].map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {name === "old_password"
                            ? "Current password"
                            : name === "new_password"
                              ? "New password"
                              : "Confirm"}
                        </FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Update password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
