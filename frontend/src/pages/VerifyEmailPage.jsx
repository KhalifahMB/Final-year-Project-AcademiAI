import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/layout/AuthLayout";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { MailCheck, RefreshCw } from "lucide-react";

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail =
    location.state?.email ||
    new URLSearchParams(location.search).get("email") ||
    "";

  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  // Auto-advance focus, paste support, backspace to go back.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");

  const focusFirstEmpty = () => {
    const idx = digits.findIndex((d) => !d);
    const target = inputsRef.current[idx >= 0 ? idx : CODE_LENGTH - 1];
    target?.focus();
    target?.select?.();
  };

  useEffect(() => {
    // Focus first box when page loads (email already filled if coming from signup)
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDigit = (i, val) => {
    // Allow only digits; support multi-char paste via val
    const clean = val.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!clean) return;
    if (clean.length === 1) {
      setDigits((prev) => {
        const next = [...prev];
        next[i] = clean;
        return next;
      });
      if (i < CODE_LENGTH - 1) {
        setTimeout(() => inputsRef.current[i + 1]?.focus(), 0);
      }
    } else {
      // Paste: fill from position i onward
      setDigits((prev) => {
        const next = [...prev];
        for (let k = 0; k < clean.length && i + k < CODE_LENGTH; k++) {
          next[i + k] = clean[k];
        }
        return next;
      });
      const nextFocus = Math.min(i + clean.length, CODE_LENGTH - 1);
      setTimeout(() => inputsRef.current[nextFocus]?.focus(), 0);
    }
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
      } else if (i > 0) {
        setDigits((prev) => {
          const next = [...prev];
          next[i - 1] = "";
          return next;
        });
        setTimeout(() => inputsRef.current[i - 1]?.focus(), 0);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      setTimeout(() => inputsRef.current[i - 1]?.focus(), 0);
    } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      setTimeout(() => inputsRef.current[i + 1]?.focus(), 0);
    }
  };

  const onPaste = (i, e) => {
    const text = e.clipboardData?.getData("text") || "";
    if (!text) return;
    e.preventDefault();
    setDigit(i, text);
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (code.length !== CODE_LENGTH) {
      setError("Please enter the full 6-digit code.");
      focusFirstEmpty();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.verifyEmail({ email: email.trim(), code });
      setOk("Verified! Redirecting you to sign in…");
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(
        err.response?.data?.error?.detail ||
          err.response?.data?.detail ||
          "Verification failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    if (!email.trim()) {
      setError("Enter your email to resend the code.");
      return;
    }
    setError("");
    setResending(true);
    try {
      await authApi.resendVerification({ email: email.trim() });
      setOk("A new code has been sent to your email.");
      setCooldown(30);
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    } catch (err) {
      setError(
        err.response?.data?.error?.detail || "Could not resend the code.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        initialEmail
          ? `We sent a 6-digit code to ${initialEmail}. Enter it below to activate your account.`
          : "Enter the 6-digit code we emailed you. Codes expire shortly."
      }
      icon={MailCheck}
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

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code-0">Verification code</Label>
          <div className="flex items-center justify-between gap-2 sm:gap-2.5">
            {digits.map((d, i) => (
              <Input
                key={i}
                id={i === 0 ? "code-0" : undefined}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
                className={cn(
                  "h-12 w-full min-w-0 flex-1 rounded-xl border-2 text-center font-mono text-xl font-semibold tracking-widest caret-primary transition-colors",
                  "px-0 sm:text-2xl",
                  d
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border",
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: paste the whole code into the first box.
          </p>
        </div>

        <Button
          type="submit"
          disabled={loading || code.length !== CODE_LENGTH}
          className="h-11 w-full font-medium shadow-sm"
        >
          {loading ? "Verifying…" : "Verify email"}
        </Button>

        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Didn't get the code?</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resend}
            disabled={resending || cooldown > 0}
            className="h-8 gap-1.5 px-2 font-medium text-primary"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", resending && "animate-spin")}
              aria-hidden
            />
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
