import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("request");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.passwordResetRequest({ email });
      setOk("If that email exists, a reset code was sent.");
      setStep("confirm");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.passwordResetConfirm({ email, token, password });
      setOk("Password updated. You can sign in.");
    } catch {
      setError("Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Reset password</CardTitle></CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
          {ok && <Alert variant="success" className="mb-3"><AlertDescription>{ok}</AlertDescription></Alert>}
          {step === "request" ? (
            <form onSubmit={requestReset} className="space-y-3">
              <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={loading}>Send reset code</Button>
            </form>
          ) : (
            <form onSubmit={confirmReset} className="space-y-3">
              <div className="space-y-1"><Label htmlFor="email2">Email</Label><Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-1"><Label htmlFor="token">Code</Label><Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required /></div>
              <div className="space-y-1"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
              <Button type="submit" className="w-full" disabled={loading}>Update password</Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Back to login</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
