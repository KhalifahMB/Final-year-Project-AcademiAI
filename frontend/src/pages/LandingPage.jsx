import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const NAV = [
  { label: 'Product', href: '#product' },
  { label: 'Who it serves', href: '#audiences' },
];

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: 'Tutoring with receipts',
    text:
      'Students ask in plain language; answers retrieve from course materials they are authorised to see, and every claim carries its chunk, page and similarity score.',
  },
  {
    icon: ClipboardList,
    title: 'Quizzes from your slides',
    text:
      'Lecturers queue the AI against chosen materials, review generated drafts, then publish. Attempts flow straight into mastery records.',
  },
  {
    icon: TrendingUp,
    title: 'Cohort signals, early',
    text:
      'Concept confusion surfaces while the term can still be steered — ranked by quiz results and what students actually ask the tutor.',
  },
];

const AUDIENCES = [
  {
    badge: 'Students',
    name: 'Amara',
    points: [
      'Grounded answers with page-level citations',
      'Practice sets generated from lecture material',
      'Mastery tracking with a review queue',
    ],
    href: '/signup',
    accent: 'from-[oklch(58%_0.18_255)] to-[oklch(50%_0.20_280)]',
  },
  {
    badge: 'Lecturers',
    name: 'Dr. Hoffmann',
    points: [
      'See confusion before the exam does',
      'Generate and publish assessments in minutes',
      'Ingest materials with OCR recovery',
    ],
    href: '/signup',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    badge: 'Administrators',
    name: 'Marcus',
    points: [
      'Tenant-wide usage and pipeline health',
      'Invites, roles and suspensions with audit trail',
      'Visibility governance per resource scope',
    ],
    href: '/signup',
    accent: 'from-amber-500 to-rose-500',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark size="h-7 w-7" />
            <span className="text-[16px] font-[680] tracking-[-0.02em] dark:text-white">
              AcademiAI
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-[13.5px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle iconOnly />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">
                Create account <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Dark hero */}
      <section className="relative isolate overflow-hidden bg-[oklch(16%_0.015_255)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 500px at 12% 0%, oklch(58% 0.18 255 / 0.28), transparent 60%),' +
              'radial-gradient(800px 500px at 90% 30%, oklch(60% 0.20 290 / 0.18), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,.8) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow mb-5 !text-white/60">
              Grounded AI for higher education
            </p>
            <h1 className="text-[44px] font-[650] leading-[1.05] tracking-[-0.025em] sm:text-[56px]">
              Every answer comes from your institution&rsquo;s own materials.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
              AcademiAI tutors students with citations down to the page, turns
              lecture slides into quizzes, and gives teaching staff a live view
              of what the cohort is struggling with.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="!bg-white !text-[oklch(18%_0.015_255)] hover:!bg-white/90 !shadow-none !rounded-[var(--radius-md)]"
                asChild
              >
                <Link to="/signup">Create free account</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="!border-white/20 !bg-white/5 !text-white hover:!bg-white/10 hover:!text-white !rounded-[var(--radius-md)]"
                asChild
              >
                <Link to="/login">Explore the prototype</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-2 text-[12px] text-white/45">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Multi-tenant · RLS-hardened · works with MinIO + Postgres + Redis + Celery
            </div>
          </div>

          {/* AI tutor mockup card */}
          <div className="relative">
            <div className="relative rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-4 shadow-[var(--shadow-pop)] backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  AI tutor · CS-301 Distributed Systems
                </span>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] tracking-wide">
                  scoped to enrolled courses
                </span>
              </div>
              <div className="mt-4 rounded-[var(--radius-md)] border border-white/10 bg-black/30 p-3.5">
                <p className="text-[13px] text-white/85">
                  <span className="font-[600] text-white">You:</span> Why does
                  Paxos need two phases if Raft manages in one?
                </p>
              </div>
              <div className="mt-3 rounded-[var(--radius-md)] bg-white/[0.06] p-3.5 text-[13px] leading-relaxed text-white/85">
                Raft folds leader election into the first phase by requiring
                candidates to carry committed entries, so log replication happens
                during the same round. In Paxos, proposer and acceptor roles are
                decoupled, which forces a separate prepare and accept phase.
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <SourceChip label="Lecture 8" detail="slides pp. 12–14" />
                  <SourceChip label="similarity" detail="0.91" mono />
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[32px] blur-2xl"
              style={{ background: 'oklch(58% 0.18 255 / 0.25)' }}
            />
          </div>
        </div>
      </section>

      {/* Product / features */}
      <section id="product" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="eyebrow">The product</p>
        <h2 className="mt-2 text-[34px] font-[650] leading-[1.1] tracking-[-0.02em]">
          One platform, three jobs done properly.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: I, title, text }) => (
            <div
              key={title}
              className="card p-5 transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="mb-4 inline-grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <I className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="text-[15px] font-[640] tracking-[-0.01em]">
                {title}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)]">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences" className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="eyebrow">Who it serves</p>
          <h2 className="mt-2 text-[34px] font-[650] leading-[1.1] tracking-[-0.02em]">
            Pick a seat and walk through it.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.badge}
                className="card flex flex-col p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="badge badge-accent">{a.badge}</span>
                  <span className="text-[12px] font-[600] text-[var(--muted)]">
                    {a.name}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5 text-[13.5px] leading-relaxed text-[var(--fg-soft)]">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span
                        className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${a.accent}`}
                        aria-hidden
                      />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  to={a.href}
                  className="mt-6 inline-flex items-center gap-1 text-[13px] font-[600] text-[var(--accent-strong)] underline-offset-4 hover:underline"
                >
                  Open {a.badge.toLowerCase()} workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-[12px] text-[var(--muted)] sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            AcademiAI prototype · demo tenant Northfield University
          </div>
          <div className="flex items-center gap-4">
            <Link to="/signup" className="hover:text-[var(--fg)]">Create account</Link>
            <Link to="/login" className="hover:text-[var(--fg)]">Sign in</Link>
            <Link to="/request-institution" className="hover:text-[var(--fg)]">
              Request your institution
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SourceChip({ label, detail, mono }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10.5px] text-white/70">
      <span className="font-[600] text-white/85">{label}</span>
      {detail && (
        <span className={mono ? 'font-mono' : ''}>{detail}</span>
      )}
    </span>
  );
}
