import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../services/api";

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
    setError("");
    setOk("");
    setLoading(true);
    try {
      await authApi.passwordResetRequest({ email });
      setOk("If that email exists, a reset code was sent.");
      setStep("confirm");
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      await authApi.passwordResetConfirm({ email, token, password });
      setOk("Password updated. You can sign in.");
    } catch (err) {
      setError(err.response?.data?.error?.detail || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-6">Reset password</h1>
        {error && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{String(error)}</div>}
        {ok && <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{ok}</div>}
        {step === "request" ? (
          <form onSubmit={requestReset} className="space-y-3">
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
              {loading ? "…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmReset} className="space-y-3">
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Code / token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
              {loading ? "…" : "Update password"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-indigo-600">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
