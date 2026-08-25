import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/layout/AuthLayout";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.verifyEmail({ email, code });
      setOk("Verified. You can sign in.");
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we emailed you. Codes expire shortly."
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
          <AlertDescription>{String(error)}</AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-10 text-center font-mono text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-10 w-full font-medium shadow-sm"
        >
          {loading ? "Verifying…" : "Verify email"}
        </Button>
      </form>
    </AuthLayout>
  );
}
