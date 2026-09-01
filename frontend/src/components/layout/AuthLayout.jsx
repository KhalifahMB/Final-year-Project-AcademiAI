import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, LibraryBig, GraduationCap, BookOpen } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';

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
    text: 'Strict tenant boundaries keep your institution’s materials private.',
  },
];

function BackgroundPattern() {
  // Deep near-black brand panel with subtle dot grid + one accent glow
  // tuned to the new indigo (hue 255) palette.
  return (
    <>
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1100px 600px at 18% -10%, oklch(58% 0.18 255 / 0.30), transparent 60%),' +
            'radial-gradient(900px 600px at 95% 110%, oklch(42% 0.20 270 / 0.45), transparent 60%),' +
            'linear-gradient(160deg, oklch(16% 0.015 255) 0%, oklch(19% 0.02 260) 55%, oklch(13% 0.01 250) 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
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
  eyebrow,
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — always dark, premium */}
      <aside className="relative hidden isolate overflow-hidden lg:flex lg:flex-col lg:justify-between p-10 text-white">
        <BackgroundPattern />

        <Link
          to="/"
          className="relative flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-white/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/95 p-[3px] shadow-[var(--shadow-pop)]">
            <img
              src="/images/Logo/academiai_icon_light.webp"
              alt="AcademiAI"
              className="block h-full w-full object-contain"
            />
          </span>
          <span className="text-[18px] font-[680] tracking-[-0.02em]">AcademiAI</span>
        </Link>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] font-[600] tracking-wide text-white/75 backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            Built for students & educators
          </div>
          <h2 className="text-[40px] font-[650] leading-[1.05] tracking-[-0.02em]">
            Your institutional
            <br />
            <span style={{
              background: 'linear-gradient(135deg, oklch(85% 0.10 255), oklch(92% 0.06 280))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
              AI study companion.
            </span>
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/65">
            Grounded answers from your own course materials, one workspace for every
            resource, quiz, and note.
          </p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: HIcon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-white ring-1 ring-white/12 backdrop-blur">
                  <HIcon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-[14px] font-[600] text-white">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/65">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-white/45">
          <span>Multi-tenant academic platform · © {new Date().getFullYear()} AcademiAI</span>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>Every answer cites a real source.</span>
          </div>
        </div>
      </aside>

      {/* Form panel — glass-first over ambient canvas */}
      <main className="app-canvas relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="absolute right-4 top-4 flex items-center gap-1.5 sm:right-6 sm:top-6">
          <Link
            to="/"
            className="rounded-[var(--radius-md)] px-2.5 py-1.5 text-[12px] font-[520] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            Home
          </Link>
          <ThemeToggle iconOnly />
        </div>

        {/* Glass form card */}
        <div className="glass-overlay neomorph mx-auto w-full max-w-[440px] rounded-[var(--radius-2xl)] p-7 sm:p-9">
          {/* Mobile brand */}
          <Link
            to="/"
            className="mb-6 flex w-fit items-center gap-2.5 rounded-md lg:hidden"
          >
            <BrandMark size="h-9 w-9" />
            <span className="text-[16px] font-[680] tracking-[-0.02em]">AcademiAI</span>
          </Link>

          {eyebrow && (
            <p className="eyebrow mb-3">{eyebrow}</p>
          )}

          {Icon && (
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          )}

          <h1 className="text-[30px] font-[650] leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
              {subtitle}
            </p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-6 text-[13px] text-[var(--muted)]">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
