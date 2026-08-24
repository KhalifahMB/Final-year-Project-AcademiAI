import { Link } from "react-router-dom";
import { GraduationCap, ShieldCheck, Sparkles, LibraryBig } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Grounded AI answers",
    text: "Every answer is cited from resources you are authorized to see.",
  },
  {
    icon: LibraryBig,
    title: "One academic home",
    text: "Courses, resources, quizzes, and progress in a single workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Institution-grade isolation",
    text: "Strict tenant boundaries protect your institution's materials.",
  },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(600px circle at 20% 20%, oklch(0.42 0.15 272 / 0.5), transparent), radial-gradient(500px circle at 80% 90%, oklch(0.55 0.13 200 / 0.35), transparent)",
          }}
          aria-hidden
        />
        <Link
          to="/"
          className="relative flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring rounded-md w-fit"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">AcademiAI</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Your institutional
            <br />
            AI study companion.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{t}</p>
                  <p className="mt-0.5 text-sm text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          Multi-tenant academic platform · © {new Date().getFullYear()} AcademiAI
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md view-enter">
          {/* Mobile brand */}
          <Link
            to="/"
            className="mb-8 flex items-center gap-2.5 lg:hidden focus-visible:outline-2 focus-visible:outline-ring rounded-md w-fit"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">AcademiAI</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
