import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Verify email</CardTitle></CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{String(error)}</AlertDescription></Alert>}
          {ok && <Alert variant="success" className="mb-3"><AlertDescription>{ok}</AlertDescription></Alert>}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="space-y-1"><Label htmlFor="code">Code</Label><Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "…" : "Verify"}</Button>
          </form>
          <p className="mt-4 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Back to login</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
