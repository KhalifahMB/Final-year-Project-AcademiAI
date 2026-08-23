import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", first_name: "", last_name: "", tenant_slug: "demo-uni", role: "student",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      await authApi.signup(form);
      setOk("Account created. Verify your email, then sign in.");
      setTimeout(() => navigate("/verify-email"), 1200);
    } catch (err) {
      const d = err.response?.data?.error?.detail;
      setError(typeof d === "string" ? d : JSON.stringify(d || "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join your institution on AcademiAI</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
          {ok && <Alert variant="success" className="mb-3"><AlertDescription>{ok}</AlertDescription></Alert>}
          <form onSubmit={submit} className="space-y-3">
            {["email", "password", "first_name", "last_name", "tenant_slug"].map((name) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={name}>{name.replace("_", " ")}</Label>
                <Input id={name} name={name} type={name === "password" ? "password" : "text"} value={form[name]} onChange={onChange} required={name === "email" || name === "password"} />
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" value={form.role} onChange={onChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="student">student</option>
                <option value="lecturer">lecturer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Sign up"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
