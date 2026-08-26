import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/components/shared/ThemeToggle";
import AvatarPicker from "@/components/shared/AvatarPicker";
import Avatar from "@/components/shared/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { profileSchema, passwordChangeSchema } from "@/lib/validations";
import api, { authApi } from "@/services/api";
import { toast } from "sonner";
import { Building2, Check, KeyRound, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";

const GENDERS = [
  { value: "unspecified", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function AppearanceCard() {
  const { dark, toggle } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sun className="h-4 w-4 text-primary" aria-hidden /> Appearance
        </CardTitle>
        <CardDescription>Choose how AcademiAI looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Theme">
          <button
            type="button"
            onClick={dark ? toggle : undefined}
            aria-pressed={!dark}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              !dark
                ? "border-primary/50 bg-primary/10 font-medium text-primary"
                : "bg-card hover:bg-muted"
            }`}
          >
            <Sun className="h-4 w-4" aria-hidden />
            Light
          </button>
          <button
            type="button"
            onClick={dark ? undefined : toggle}
            aria-pressed={dark}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              dark
                ? "border-primary/50 bg-primary/10 font-medium text-primary"
                : "bg-card hover:bg-muted"
            }`}
          >
            <Moon className="h-4 w-4" aria-hidden />
            Dark
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function InstitutionCard({ user }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-4 w-4 text-primary" aria-hidden /> Institution
        </CardTitle>
        <CardDescription>
          Managed by your institution's administrators — read-only for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Role</span>
          <Badge className="capitalize">{user?.role}</Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Email verified</span>
          <Badge variant={user?.is_email_verified ? "default" : "secondary"}>
            {user?.is_email_verified ? "Verified" : "Not verified"}
          </Badge>
        </div>
        <Separator />
        <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Programme, department and enrollment details are maintained by your
          institution. Contact your administrator to correct them.
        </p>
      </CardContent>
    </Card>
  );
}

function ProfileHeader({ user }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/90 via-primary to-indigo-700 p-6 text-white shadow-md sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex flex-wrap items-center gap-5">
        <Avatar
          user={user}
          className="h-20 w-20 border-2 border-white/40 shadow-lg sm:h-24 sm:w-24"
        />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email}
          </h2>
          <p className="mt-0.5 truncate text-sm text-white/80">{user?.email}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium capitalize backdrop-blur">
              {user?.role}
            </span>
            {user?.is_email_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Verified
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const qc = useQueryClient();
  const [profileError, setProfileError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [presetId, setPresetId] = useState(user?.avatar_preset || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    setPresetId(user?.avatar_preset || "");
  }, [user?.avatar_preset]);

  const onPickFile = (f) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const saveAvatar = async () => {
    setSavingAvatar(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post("/auth/me/avatar/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        await api.patch("/auth/me/", { avatar_preset: "" });
      } else if (presetId !== (user?.avatar_preset || "")) {
        await api.patch("/auth/me/", { avatar_preset: presetId });
        await api.delete("/auth/me/avatar/");
      }
      toast.success("Profile picture updated");
      qc.removeQueries({ queryKey: ["avatar-url"] });
      setFile(null);
      setPreview(null);
      if (reload) await reload();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || "Could not update picture");
    } finally {
      setSavingAvatar(false);
    }
  };

  // --- Personal info -------------------------------------------------
  const form = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      phone_number: user?.phone_number || "",
      gender: user?.gender || "",
    },
  });

  const onSaveProfile = async (values) => {
    setProfileError("");
    try {
      await authApi.updateMe(values);
      toast.success("Profile updated");
      qc.removeQueries({ queryKey: ["avatar-url"] });
      if (reload) await reload();
    } catch (err) {
      const d = err.response?.data;
      const detail =
        d?.error?.detail ||
        (typeof d === "object" ? Object.values(d).flat().join(" ") : "") ||
        "Update failed";
      setProfileError(String(detail));
    }
  };

  // --- Password -------------------------------------------------------
  const pwForm = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });
  const [pwError, setPwError] = useState("");

  const onSubmitPassword = async (values) => {
    setPwError("");
    try {
      await authApi.passwordChange({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("Password updated");
      pwForm.reset();
    } catch (err) {
      setPwError(err.response?.data?.error?.detail || "Password change failed");
    }
  };

  return (
    <AppShell
      title="Settings"
      description="Manage your personal profile, security, and appearance."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <ProfileHeader user={user} />

        {/* Profile picture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile picture</CardTitle>
            <CardDescription>
              Shown next to your name across AcademiAI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {avatarError && (
              <Alert variant="destructive">
                <AlertDescription>{avatarError}</AlertDescription>
              </Alert>
            )}
            <AvatarPicker
              presetId={presetId}
              onPresetId={setPresetId}
              file={file}
              preview={preview}
              onFile={onPickFile}
              onError={setAvatarError}
            />
            <Button
              type="button"
              size="sm"
              disabled={
                savingAvatar ||
                (!file && presetId === (user?.avatar_preset || ""))
              }
              onClick={saveAvatar}
            >
              <Check className="mr-2 h-4 w-4" aria-hidden />
              {savingAvatar ? "Saving…" : "Save picture"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-4 w-4 text-primary" aria-hidden /> Personal information
              </CardTitle>
              <CardDescription>Your private account details.</CardDescription>
            </CardHeader>
            <CardContent>
              {profileError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription>{String(profileError)}</AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSaveProfile)} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+234 800 000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select value={field.value || "unspecified"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDERS.map((g) => (
                              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Save changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Change password
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pwError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>{String(pwError)}</AlertDescription>
                  </Alert>
                )}
                <Form {...pwForm}>
                  <form onSubmit={pwForm.handleSubmit(onSubmitPassword)} className="space-y-3">
                    {["old_password", "new_password", "confirm"].map((name) => (
                      <FormField
                        key={name}
                        control={pwForm.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {name === "old_password"
                                ? "Current password"
                                : name === "new_password"
                                  ? "New password"
                                  : "Confirm new password"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                autoComplete={
                                  name === "old_password" ? "current-password" : "new-password"
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <Button type="submit" disabled={pwForm.formState.isSubmitting}>
                      Update password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <InstitutionCard user={user} />
            <AppearanceCard />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
