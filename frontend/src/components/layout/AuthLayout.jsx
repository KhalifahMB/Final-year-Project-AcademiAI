import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, LibraryBig } from "lucide-react";
import ThemeToggle from "@/components/shared/ThemeToggle";
import BrandMark from "@/components/shared/BrandMark";

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
      {/* Brand panel — always-dark gradient, matching the landing page CTA band */}
      <aside className="relative hidden isolate overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(to bottom right, oklch(0.42 0.2 293), oklch(0.4 0.18 275), oklch(0.45 0.16 255))",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.16), transparent 55%)",
          }}
          aria-hidden
        />
        <Link
          to="/"
          className="relative flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
          {/* Light logo asset on the always-dark panel */}
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-lg">
            <img
              src="/images/Logo/academiai_icon_light.webp"
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">AcademiAI</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-[1.05] tracking-tight text-white">
            Your institutional
            <br />
            AI study companion.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Multi-tenant academic platform · © {new Date().getFullYear()} AcademiAI
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        {/* Theme toggle — available on every auth screen */}
        <div className="absolute right-5 top-5 flex items-center gap-2 sm:right-10">
          <Link
            to="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            Home
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-md view-enter">
          {/* Mobile brand — same assets as landing page */}
          <Link
            to="/"
            className="mb-8 flex w-fit items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-ring rounded-md lg:hidden"
          >
            <BrandMark />
            <span className="text-base font-bold tracking-tight">AcademiAI</span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
