import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../services/api";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    tenant_slug: "demo-uni",
    role: "student",
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
      setOk("Account created. Check email for verification code, then log in.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const d = err.response?.data?.error?.detail;
      setError(typeof d === "string" ? d : JSON.stringify(d || "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-6">Create AcademiAI account</h1>
        {error && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
        {ok && <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{ok}</div>}
        <form onSubmit={submit} className="space-y-3">
          {["email", "password", "first_name", "last_name", "tenant_slug"].map((name) => (
            <div key={name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{name.replace("_", " ")}</label>
              <input
                type={name === "password" ? "password" : "text"}
                name={name}
                value={form[name]}
                onChange={onChange}
                required={name === "email" || name === "password"}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">role</label>
            <select name="role" value={form.role} onChange={onChange} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="student">student</option>
              <option value="lecturer">lecturer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Have an account? <Link to="/login" className="text-indigo-600">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
