import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Bookmark,
  Bot,
  Building2,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Landmark,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const CORE_FEATURES = [
  {
    icon: Bot,
    title: 'Tutoring with receipts',
    text:
      'Ask in plain language; answers retrieve from course materials you are authorised to see and every claim carries its chunk, page and similarity score.',
    chip: 'Citations included',
  },
  {
    icon: ClipboardList,
    title: 'Quizzes from your slides',
    text:
      'Lecturers queue the AI against chosen materials, review generated drafts, then publish. Attempts flow straight into mastery records.',
    chip: 'AI generated',
  },
  {
    icon: TrendingUp,
    title: 'Cohort signals, early',
    text:
      'Concept confusion surfaces while the term can still be steered — ranked by quiz results and what students actually ask the tutor.',
    chip: 'Live insight',
  },
];

const SECONDARY_FEATURES = [
  { icon: Bookmark, t: 'Bookmarks & notes', d: 'A personal learning space that follows you across every course.' },
  { icon: FileText, t: 'Smart summaries', d: 'Concise digests of lecture material — one tap away.' },
  { icon: ShieldCheck, t: 'Tenant isolation', d: 'Database-level RLS keeps each university private.' },
];

const HOW_STEPS = [
  {
    n: '01',
    title: 'Your university gets its own tenant',
    text: 'Each institution gets an isolated workspace with faculties, departments, courses, roles and permissions.',
  },
  {
    n: '02',
    title: 'Lecturers upload authorised materials',
    text: 'Lecture notes, PDFs and slides are chunked, embedded and understood by the AI — within that tenant only.',
  },
  {
    n: '03',
    title: 'Students learn with cited answers',
    text: 'Chat, generate quizzes and build summaries — all grounded in your own university\'s materials, with citations you can open.',
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
    accent: 'from-emerald-500 [var(--success)]',
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

const EXTRAS = [
  {
    icon: Smartphone,
    tag: 'Coming soon',
    title: 'AcademiAI mobile',
    text: 'Study on the go, offline access, push notifications for quizzes and updates.',
  },
  {
    icon: UsersRound,
    tag: 'Coming soon',
    title: 'Collaborative study boards',
    text: 'Collaborate with classmates across your university — shared boards with grounded context.',
  },
];

/* ------------------------------------------------------------------ */
/* Institutions directory                                              */
/* ------------------------------------------------------------------ */

function InstitutionDirectory() {
  const [search, setSearch] = useState('');
  const q = search.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-directory', q],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/', {
        params: q ? { search: q } : {},
      });
      return data.results || [];
    },
    staleTime: 60_000,
  });

  const institutions = data || [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for your university…"
          aria-label="Search institutions"
          className="h-11 rounded-[var(--radius-lg)] pl-11 text-[14px]"
        />
      </div>

      <div className="mt-5" role="list" aria-label="Institutions">
        {isLoading ? (
          <SkeletonRows rows={2} />
        ) : institutions.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <Building2 className="mx-auto h-6 w-6 text-[var(--muted)]" aria-hidden />
            <p className="mt-3 text-[14px] font-[600]">
              {q ? `No institutions match “${q}”` : 'No institutions yet'}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Universities are onboarded by the platform team — yours could be next.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {institutions.map((t) => (
              <li key={t.id} role="listitem">
                <div className="card flex items-center gap-3 p-4 transition-colors hover:border-[var(--border-strong)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[13px] font-[650] uppercase text-[var(--accent-strong)]">
                    {(t.name?.[0] || '?').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-[600]" title={t.name}>
                      {t.name}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">/{t.slug}</p>
                  </div>
                  <Link
                    to="/signup"
                    className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[12px] font-[600] transition-colors hover:bg-[var(--hover)]"
                  >
                    Join
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] antialiased">
      {/* ---------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            <BrandMark size="h-7 w-7" />
            <span className="text-[16px] font-[680] tracking-[-0.02em]">
              AcademiAI
            </span>
            <span className="ml-1 hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)] lg:inline-block">
              Multi-tenant · FYP
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Page sections">
            {[
              ['#product', 'Product'],
              ['#how', 'How it works'],
              ['#audiences', 'Who it serves'],
              !isAuthenticated && ['#institutions', 'Universities'],
              ['#case-study', 'Case study'],
            ].filter(Boolean).map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-[var(--radius-md)] px-3 py-1.5 text-[13.5px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle iconOnly />
            {isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">
                  Open workspace <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">
                    Create free account <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden bg-[oklch(16%_0.015_255)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 600px at 12% 0%, oklch(58% 0.18 255 / 0.28), transparent 60%),' +
              'radial-gradient(900px 500px at 90% 30%, oklch(60% 0.20 290 / 0.18), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.8) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-[600] tracking-[0.06em] text-white/75 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
              Multi-tenant · Built as a Final Year Project
            </span>
            <h1 className="mt-6 max-w-[16ch] text-[44px] font-[650] leading-[1.03] tracking-[-0.025em] sm:text-[56px]">
              Every answer comes from your institution&rsquo;s own{' '}
              <span
                style={{
                  background:
                    'linear-gradient(135deg, oklch(80% 0.12 255), oklch(88% 0.08 280))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                materials.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
              AcademiAI gives every university its own AI tutor. Students access, understand and excel with their course materials through intelligent chat, personalised quizzes and cohort insight — all grounded in authorised resources. Implemented as a case study at Abubakar Tafawa Balewa University, Bauchi.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  className="!h-11 !rounded-[var(--radius-md)] !bg-white !px-7 !text-[14px] !font-[620] !text-[oklch(18%_0.015_255)] hover:!bg-white/90"
                  asChild
                >
                  <Link to="/dashboard">
                    Open workspace
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="!h-11 !rounded-[var(--radius-md)] !bg-white !px-7 !text-[14px] !font-[620] !text-[oklch(18%_0.015_255)] hover:!bg-white/90"
                    asChild
                  >
                    <Link to="/signup">
                      Create free account
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <a
                    href="#institutions"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/20 bg-white/5 px-7 text-[14px] font-[600] text-white backdrop-blur transition-colors hover:bg-white/10"
                  >
                    Find your university
                  </a>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> Live implementation
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure &amp; tenant-isolated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" aria-hidden /> Scales to any faculty
              </span>
            </div>
          </div>

          {/* Hero visual — generated AcademiAI tutor mock */}
          <div className="relative">
            <img
              src="/images/landing/hero-academiai-tutor.png"
              alt="AcademiAI AI tutor showing a cited answer with source chips"
              className="relative z-[1] w-full rounded-[20px] [filter:drop-shadow(0_30px_60px_oklch(58%_0.18_255/0.35))]"
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Product */}
      <section id="product" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">The product</p>
            <h2 className="mt-2 max-w-[18ch] text-[34px] font-[650] leading-[1.05] tracking-[-0.02em]">
              Your complete academic assistant.
            </h2>
          </div>
          <p className="max-w-[44ch] text-[14px] leading-relaxed text-[var(--muted)]">
            Designed for universities to provide grounded AI assistance to their students — every answer traced to authorised course materials in your university&rsquo;s tenant.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {CORE_FEATURES.map(({ icon: Icon, title, text, chip }) => (
            <div
              key={title}
              className="card p-6 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex items-start justify-between">
                <span className="mb-4 inline-grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-[11px] font-[600] text-[var(--success)]">
                  {chip}
                </span>
              </div>
              <h3 className="text-[15px] font-[640] tracking-[-0.01em]">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SECONDARY_FEATURES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)]/50 p-5">
              <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--accent-strong)]" aria-hidden />
              <div>
                <p className="text-[14px] font-[620]">{t}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------- Collaboration image banner */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)]">
            <img
              src="/images/holographic_ai_library_collaboration.webp"
              alt="Students collaborating with an AI assistant inside a digital library"
              className="aspect-[16/7] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-[650] text-zinc-900 backdrop-blur">
                  <GraduationCap className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden />
                  One workspace per university — students, lecturers, admins
                </p>
                <h3 className="mt-3 max-w-[22ch] text-[22px] font-[650] leading-[1.1] tracking-[-0.02em] text-white">
                  Grounded answers, one cohort at a time.
                </h3>
              </div>
              <p className="max-w-[36ch] rounded-[var(--radius-md)] bg-white/10 px-3 py-2 text-[12.5px] leading-relaxed text-white/80 backdrop-blur">
                Answers are scoped to materials the student is actually enrolled to see — your university&rsquo;s content never leaks between tenants.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 scroll-mt-16 sm:px-8 lg:py-24">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 max-w-[20ch] text-[34px] font-[650] leading-[1.05] tracking-[-0.02em]">
              How AcademiAI works for your university.
            </h2>
          </div>
          <p className="max-w-[46ch] text-[14px] leading-relaxed text-[var(--muted)]">
            A multi-tenant architecture where each university gets its own isolated, secure environment — scalable to any faculty or department.
          </p>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <ol className="space-y-8">
            {HOW_STEPS.map(({ n, title, text }) => (
              <li key={n} className="flex gap-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] font-mono text-[13px] font-[650] text-[var(--accent-strong)]">
                  {n}
                </span>
                <div>
                  <h3 className="text-[15px] font-[640] tracking-[-0.01em]">{title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)]">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)]">
            <img
              src="/images/abuja_campus_sunset.webp"
              alt="University campus at sunset"
              loading="lazy"
              className="aspect-[4/3] h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
            <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-[650] text-zinc-900 backdrop-blur">
              <Landmark className="h-3.5 w-3.5" aria-hidden />
              Case study: ATBU campus · Faculty of Computing
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Knowledge showcase */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="overflow-hidden rounded-[20px] border border-[var(--border)]">
            <img
              src="/images/ai_knowledge_graph_visualization.webp"
              alt="Knowledge graph connecting course concepts"
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-[600] tracking-[0.06em] text-[var(--accent-strong)]">
              <Bot className="h-3.5 w-3.5" aria-hidden /> Under the hood
            </span>
            <h2 className="mt-4 text-[28px] font-[650] leading-[1.1] tracking-[-0.02em] sm:text-[32px]">
              A knowledge graph behind every answer.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--muted)]">
              Uploaded documents are chunked, embedded and linked into a concept map of your curriculum. When you ask a question, AcademiAI retrieves the exact passages and cites them — never a hallucinated reference.
            </p>
            <ul className="mt-6 space-y-2.5 text-[13.5px]">
              {[
                'Citations point to real passages you can open',
                'Concept-level progress tracking as you study',
                'Visibility scopes keep materials within your institution',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- Audiences */}
      <section id="audiences" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Who it serves</p>
            <h2 className="mt-2 max-w-[20ch] text-[34px] font-[650] leading-[1.05] tracking-[-0.02em]">
              Pick a seat and walk through it.
            </h2>
          </div>
          <p className="max-w-[44ch] text-[14px] leading-relaxed text-[var(--muted)]">
            AcademiAI is built for three working roles on day one — students learning, lecturers teaching, and administrators governing.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.badge} className="card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="badge badge-accent">{a.badge}</span>
                <span className="text-[12px] font-[600] text-[var(--muted)]">{a.name}</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-[13.5px] leading-relaxed text-[var(--fg-soft)]">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full  ${a.accent}`}
                      aria-hidden
                    />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                to={a.href}
                className="mt-auto pt-6 inline-flex items-center gap-1 text-[13px] font-[620] text-[var(--accent-strong)] underline-offset-4 hover:underline"
              >
                Open {a.badge.toLowerCase()} workspace
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------- Institutions */}
      <section id="institutions" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20 scroll-mt-16 sm:px-8 lg:py-24">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Universities</p>
              <h2 className="mt-2 max-w-[18ch] text-[34px] font-[650] leading-[1.05] tracking-[-0.02em]">
                Find your university.
              </h2>
            </div>
            <p className="max-w-[42ch] text-[14px] leading-relaxed text-[var(--muted)]">
              Each university gets its own private workspace. Browse the directory and join yours in under a minute.
            </p>
          </div>
          <InstitutionDirectory />
        </div>
      </section>

      {/* --------------------------------------------------- Coming soon */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-center text-[11px] font-[600] uppercase tracking-[0.14em] text-[var(--muted)]">
          On the roadmap
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {EXTRAS.map(({ icon: Icon, tag, title, text }) => (
            <div
              key={title}
              className="card flex items-start gap-4 p-6 transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="flex items-center gap-2 text-[14.5px] font-[640]">
                  {title}
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {tag}
                  </span>
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--muted)]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- Case study */}
      <section id="case-study" className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[900px] px-5 py-20 text-center scroll-mt-16 sm:px-6 lg:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-[600] tracking-[0.06em] text-[var(--muted)]">
            <GraduationCap className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden />
            Final Year Project · Department of Computer Science
          </span>
          <h2 className="mt-6 text-[32px] font-[650] leading-[1.1] tracking-[-0.02em] sm:text-[38px]">
            Case study: Abubakar Tafawa Balewa University, Bauchi.
          </h2>
          <p className="mx-auto mt-5 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--muted)]">
            AcademiAI is being developed as a Final Year Project for the Department of Computer Science, Faculty of Computing, ATBU Bauchi. The faculty serves as the initial implementation example, demonstrating how any university can adopt AcademiAI as a multi-tenant solution — starting with Computer Science courses, with architecture ready for any faculty and university.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="relative isolate overflow-hidden bg-[oklch(16%_0.015_255)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(800px 400px at 20% 20%, oklch(58% 0.18 255 / 0.35), transparent 60%),' +
              'radial-gradient(700px 400px at 80% 80%, oklch(60% 0.20 290 / 0.25), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.8) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 lg:py-28">
          <h2 className="text-[34px] font-[650] leading-[1.05] tracking-[-0.02em] sm:text-[44px]">
            Join the future of academic learning.
          </h2>
          <p className="mx-auto mt-4 max-w-[60ch] text-[15px] leading-relaxed text-white/75">
            Multi-tenant, secure, grounded. Built as an ATBU Faculty of Computing case study — open for collaboration with any university.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Button
                size="lg"
                className="!h-11 !rounded-[var(--radius-md)] !bg-white !px-8 !text-[14px] !font-[620] !text-[oklch(18%_0.015_255)] hover:!bg-white/90"
                asChild
              >
                <Link to="/dashboard">
                  Open your workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="!h-11 !rounded-[var(--radius-md)] !bg-white !px-8 !text-[14px] !font-[620] !text-[oklch(18%_0.015_255)] hover:!bg-white/90"
                  asChild
                >
                  <Link to="/signup">
                    Get started free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <a
                  href="#institutions"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/25 bg-white/5 px-8 text-[14px] font-[600] text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  Browse universities
                </a>
              </>
            )}
          </div>
          <p className="mt-8 text-[12px] text-white/60">
            Multi-tenant · For any university · Open for collaboration
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark size="h-8 w-8" />
              <span className="text-[16px] font-[680] tracking-[-0.02em]">AcademiAI</span>
            </Link>
            <p className="mt-3 max-w-[36ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              AI-powered academic assistance for every university. Multi-tenant platform · Final Year Project · Computer Science · ATBU Bauchi (case study).
            </p>
          </div>
          <nav aria-label="Product">
            <p className="eyebrow !tracking-[0.14em]">Product</p>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#product">For students</a></li>
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#audiences">For lecturers</a></li>
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#audiences">For admins</a></li>
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#institutions">Institutions directory</a></li>
            </ul>
          </nav>
          <nav aria-label="Project">
            <p className="eyebrow !tracking-[0.14em]">Project</p>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#case-study">Final Year Project 2025/2026</a></li>
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#case-study">ATBU case study</a></li>
              <li><a className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" href="#how">Multi-tenant architecture</a></li>
              {!isAuthenticated && (
                <li><Link className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]" to="/request-institution">Request your institution</Link></li>
              )}
            </ul>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl border-t border-[var(--border)] px-5 py-6 sm:px-8">
          <p className="text-center text-[12px] text-[var(--muted)]">
            © {new Date().getFullYear()} AcademiAI — built for defence · designed for scale · open for collaboration
          </p>
        </div>
      </footer>
    </div>
  );
}
