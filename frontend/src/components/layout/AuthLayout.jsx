import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, LibraryBig, GraduationCap, BookOpen } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'Grounded AI answers',
    text: 'Every answer is cited from course materials you are authorized to see.',
  },
  {
    icon: LibraryBig,
    title: 'One academic home',
    text: 'Resources, quizzes, notes, and progress in a single focused workspace.',
  },
  {
    icon: ShieldCheck,
    title: 'Institution-grade isolation',
    text: 'Strict tenant boundaries keep your institution\u2019s materials private.',
  },
];

function BackgroundPattern() {
  // Subtle dot grid + radial glow — always dark so the panel stays premium.
  return (
    <>
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 20% -10%, rgba(139,127,255,0.35), transparent 60%), radial-gradient(900px 500px at 90% 110%, rgba(90,72,220,0.45), transparent 60%), linear-gradient(135deg, #0f0c29 0%, #121033 40%, #0b0820 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />
    </>
  );
}

export default function AuthLayout({
  title,
  subtitle,
  icon: Icon,
  footer,
  children,
  headingAccent,
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden isolate overflow-hidden lg:flex lg:flex-col lg:justify-between p-10 text-white">
        <BackgroundPattern />

        {/* Decorative floating shapes */}
        <div className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" aria-hidden />

        <Link
          to="/"
          className="relative flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-white/40"
        >
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-lg">
            <img
              src="/images/Logo/academiai_icon_light.webp"
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-xl font-bold tracking-tight">AcademiAI</span>
        </Link>

        <div className="relative max-w-md">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            Built for students & educators
          </div>
          <h2 className="text-[40px] font-bold leading-[1.05] tracking-tight">
            Your institutional
            <br />
            <span className="bg-gradient-to-r from-violet-300 to-indigo-200 bg-clip-text text-transparent">
              AI study companion.
            </span>
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70">
            Grounded answers from your own course materials, one workspace for every
            resource, quiz, and note.
          </p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: HIcon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white ring-1 ring-white/15 backdrop-blur">
                  <HIcon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-white/50">
          <span>Multi-tenant academic platform · © {new Date().getFullYear()} AcademiAI</span>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>Learn smarter.</span>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col justify-center bg-background px-5 py-10 sm:px-10 lg:px-16">
        <div className="absolute right-4 top-4 flex items-center gap-1.5 sm:right-6 sm:top-6">
          <Link
            to="/"
            className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            Home
          </Link>
          <ThemeToggle iconOnly />
        </div>

        <div className="mx-auto w-full max-w-[380px]">
          {/* Mobile brand */}
          <Link
            to="/"
            className="mb-8 flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          >
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border">
              <img
                src="/images/Logo/academiai_icon_light.webp"
                alt=""
                aria-hidden
                className="h-full w-full object-contain dark:hidden"
              />
              <img
                src="/images/Logo/academiai_icon_dark.png"
                alt=""
                aria-hidden
                className="hidden h-full w-full object-contain dark:block"
              />
            </span>
            <span className="text-base font-semibold tracking-tight">AcademiAI</span>
          </Link>

          {Icon && (
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          )}
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            {title}
            {headingAccent && (
              <span className="ai-text"> {headingAccent}</span>
            )}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-6 text-[13px] text-muted-foreground">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
