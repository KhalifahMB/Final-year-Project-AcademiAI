import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useScrollReveal } from '@/hooks/useScrollReveal';
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
  BookOpen,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Landmark,
  Paperclip,
  Search,
  Shield,
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
    icon: GraduationCap,
    points: [
      'Grounded answers with page-level citations',
      'Practice sets generated from lecture material',
      'Mastery tracking with a review queue',
    ],
    href: '/signup',
    gradient: 'linear-gradient(135deg, var(--accent), oklch(52% 0.20 280))',
  },
  {
    badge: 'Lecturers',
    name: 'Dr. Hoffmann',
    icon: BookOpen,
    points: [
      'See confusion before the exam does',
      'Generate and publish assessments in minutes',
      'Ingest materials with OCR recovery',
    ],
    href: '/signup',
    gradient: 'linear-gradient(135deg, var(--success), oklch(55% 0.14 165))',
  },
  {
    badge: 'Administrators',
    name: 'Marcus',
    icon: Shield,
    points: [
      'Tenant-wide usage and pipeline health',
      'Invites, roles and suspensions with audit trail',
      'Visibility governance per resource scope',
    ],
    href: '/signup',
    gradient: 'linear-gradient(135deg, var(--warn), oklch(60% 0.17 32))',
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
/* Hero — theme-aware code-drawn app mock                              */
/* ------------------------------------------------------------------ */

function HeroMock() {
  return (
    <div className="relative">
      {/* Token-driven halo behind the window */}
      <div
        aria-hidden
        className="hero-glow absolute -inset-6 -z-10 rounded-[32px] opacity-80"
      />

      <div className="mock-window mock-drift relative overflow-hidden rounded-[20px]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
          <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-[620] text-[var(--muted)]">
            <Bot className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden />
            AcademiAI tutor
          </span>
        </div>

        {/* Chat body */}
        <div className="space-y-3 px-4 py-5">
          {/* User bubble */}
          <div className="flex justify-end">
            <p className="max-w-[76%] rounded-[14px] rounded-br-[4px] bg-[var(--accent)] px-3.5 py-2 text-[13px] leading-relaxed text-[var(--on-accent)]">
              Summarise module 4 and quiz me on it.
            </p>
          </div>

          {/* AI response */}
          <div className="flex gap-2.5">
            <span className="mt-0.5 inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 rounded-[14px] rounded-tl-[4px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[13px] font-[630]">Scheduling algorithms</p>
              <div className="mt-1.5 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  lecture-04.pdf
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--success)]">
                  <Check className="h-3 w-3" aria-hidden />
                  cited
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="answer-line h-2 rounded-full" />
                <div className="answer-line h-2 rounded-full" style={{ width: '88%' }} />
                <div className="answer-line h-2 rounded-full" style={{ width: '64%' }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 font-mono text-[10.5px] font-[600] text-[var(--success)]">
                  source · p.42 · sim 92%
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10.5px] font-[600] text-[var(--accent-strong)]">
                  quiz ready
                </span>
                <span
                  aria-hidden
                  className="ai-cursor ml-auto inline-block h-2 w-2 rounded-full bg-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating stat chips — bob gently, glass + neomorph accent */}
      <div className="badge-bob card-glass neomorph absolute -left-3 top-14 z-[2] hidden rounded-[var(--radius-lg)] px-3 py-2 text-[11px] font-[600] text-[var(--fg-soft)] lg:block">
        <span className="font-mono font-[680] text-[var(--success)]">42ms</span>&nbsp;avg response
      </div>
      <div className="badge-bob--delay badge-bob card-glass neomorph absolute -right-2 bottom-4 z-[2] hidden rounded-[var(--radius-lg)] px-3 py-2 text-[11px] font-[600] text-[var(--fg-soft)] lg:block">
        <span className="font-mono font-[680] text-[var(--accent-strong)]">500+</span>&nbsp;concepts mapped
      </div>
    </div>
  );
}

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
                <div className="card card-surface-hover flex items-center gap-3 p-4">
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
/* Stats strip                                                         */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: '500+', label: 'Concepts mapped', color: 'var(--accent)' },
  { value: '12k+', label: 'Citations generated', color: 'var(--success)' },
  { value: '42ms', label: 'Avg response time', color: 'var(--warn)' },
  { value: '100%', label: 'Tenant isolated', color: 'var(--info)' },
];

function StatsStrip() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 });

  return (
    <section ref={ref} className="border-y border-[var(--border)]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-10 sm:px-8 md:grid-cols-4 md:gap-5">
        {STATS.map(({ value, label, color }, i) => (
          <div
            key={label}
            className={`card-glass neomorph rounded-[var(--radius-lg)] px-4 py-5 text-center transition-colors hover:border-[var(--border-strong)] ${
              isVisible ? 'stat-enter' : 'opacity-0'
            }`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <p className="num text-[28px] font-[680] tracking-[-0.02em]" style={{ color }}>{value}</p>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Product section (bento layout)                                      */
/* ------------------------------------------------------------------ */

function ProductSection() {
  const { ref: headRef, isVisible: headVisible } = useScrollReveal();
  const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.1 });
  const { ref: stripRef, isVisible: stripVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section id="product" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
      <div
        ref={headRef}
        className={`mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end sr ${headVisible ? 'sr--visible' : ''}`}
      >
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

      <div ref={gridRef} className="bento-grid">
        {CORE_FEATURES.map(({ icon: Icon, title, text, chip }, i) => (
          <div
            key={title}
            className={`card-glass card-surface-hover p-6 sr ${gridVisible ? 'sr--visible' : ''}`}
            style={{ transitionDelay: `${i * 0.08}s` }}
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

      <div ref={stripRef} className="mt-6 flex flex-wrap gap-4">
        {SECONDARY_FEATURES.map(({ icon: Icon, t, d }, i) => (
          <div
            key={t}
            className={`flex flex-1 items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)]/50 p-5 sr ${stripVisible ? 'sr--visible' : ''}`}
            style={{ transitionDelay: `${i * 0.06}s`, minWidth: '200px' }}
          >
            <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--accent-strong)]" aria-hidden />
            <div>
              <p className="text-[14px] font-[620]">{t}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Collaboration banner                                                */
/* ------------------------------------------------------------------ */

function CollaborationBanner() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
        <div
          ref={ref}
          className={`relative overflow-hidden rounded-[20px] border border-[var(--border)] sr ${isVisible ? 'sr--visible' : ''}`}
          style={{
            transform: isVisible ? 'scale(1)' : 'scale(0.985)',
            transition: 'transform 0.5s cubic-bezier(0.2,0,0,1)',
          }}
        >
          <img
            src="/images/holographic_ai_library_collaboration.webp"
            alt="Students collaborating with an AI assistant inside a digital library"
            className="aspect-[16/7] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
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
            <p className="max-w-[36ch] rounded-[var(--radius-md)] bg-white/10 px-3 py-2 text-[12.5px] leading-relaxed text-white/85 backdrop-blur">
              Answers are scoped to materials the student is actually enrolled to see — your university&rsquo;s content never leaks between tenants.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const { ref: headRef, isVisible: headVisible } = useScrollReveal();
  const { ref: stepsRef, isVisible: stepsVisible } = useScrollReveal({ threshold: 0.1 });
  const { ref: imgRef, isVisible: imgVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-20 scroll-mt-16 sm:px-8 lg:py-24">
      <div
        ref={headRef}
        className={`mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end sr ${headVisible ? 'sr--visible' : ''}`}
      >
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
        <ol ref={stepsRef} className="space-y-8">
          {HOW_STEPS.map(({ n, title, text }, i) => (
            <li
              key={n}
              className={`step-line flex gap-5 sr ${stepsVisible ? 'sr--visible' : ''}`}
              style={{ transitionDelay: `${i * 0.12}s` }}
            >
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
        <div
          ref={imgRef}
          className={`relative overflow-hidden rounded-[20px] border border-[var(--border)] sr ${imgVisible ? 'sr--visible' : ''}`}
        >
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
  );
}

/* ------------------------------------------------------------------ */
/* Knowledge showcase                                                  */
/* ------------------------------------------------------------------ */

function KnowledgeShowcase() {
  const { ref: textRef, isVisible: textVisible } = useScrollReveal();
  const { ref: imgRef, isVisible: imgVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div
          ref={textRef}
          className={`order-2 lg:order-1 sr ${textVisible ? 'sr--visible' : ''}`}
        >
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
        <div
          ref={imgRef}
          className={`order-1 overflow-hidden rounded-[20px] border border-[var(--border)] lg:order-2 sr ${imgVisible ? 'sr--visible' : ''}`}
        >
          <img
            src="/images/ai_knowledge_graph_visualization.webp"
            alt="Knowledge graph connecting course concepts"
            loading="lazy"
            className="tilt-hover aspect-[4/3] w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  ['#product', 'Product'],
  ['#how', 'How it works'],
  ['#audiences', 'Who it serves'],
  ['#case-study', 'Case study'],
];

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
              ...NAV_LINKS,
              !isAuthenticated && ['#institutions', 'Universities'],
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
      <section className="app-canvas relative isolate overflow-hidden">
        {/* Theme-aware backdrops (fg-derived, no hardcoded white/dark) */}
        <div
          aria-hidden
          className="hero-glow pointer-events-none absolute inset-0 -z-10"
        />
        <div
          aria-hidden
          className="hero-dots pointer-events-none absolute inset-0 -z-10 opacity-60"
        />
        <div className="hero-rise relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="hero-rise--d1 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-[600] tracking-[0.06em] text-[var(--muted)] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
              Multi-tenant · Built as a Final Year Project
            </span>
            <h1 className="hero-rise--d2 mt-6 max-w-[16ch] text-[44px] font-[650] leading-[1.03] tracking-[-0.025em] sm:text-[56px]">
              Every answer comes from your institution&rsquo;s own{' '}
              <span className="ai-text">materials.</span>
            </h1>
            <p className="hero-rise--d3 mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
              AcademiAI gives every university its own AI tutor. Students access, understand and excel with their course materials through intelligent chat, personalised quizzes and cohort insight — all grounded in authorised resources. Implemented as a case study at Abubakar Tafawa Balewa University, Bauchi.
            </p>
            <div className="hero-rise--d3 mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link to="/dashboard">
                    Open workspace
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link to="/signup">
                      Create free account
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="#institutions">
                      Find your university
                    </a>
                  </Button>
                </>
              )}
            </div>
            <div className="hero-rise--d4 mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden /> Live implementation
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden /> Secure &amp; tenant-isolated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5 text-[var(--info)]" aria-hidden /> Scales to any faculty
              </span>
            </div>
          </div>

          {/* Hero visual — theme-aware code-drawn app mock */}
          <div className="hero-rise--d2">
            <HeroMock />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Stats strip */}
      <StatsStrip />

      {/* ----------------------------------------------------- Product */}
      <ProductSection />

      {/* --------------------------------------------- Collaboration image banner */}
      <CollaborationBanner />

      {/* --------------------------------------------- How it works */}
      <HowItWorks />

      {/* ------------------------------------------- Knowledge showcase */}
      <KnowledgeShowcase />

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
          {AUDIENCES.map((a) => {
            const RoleIcon = a.icon;
            return (
              <div
                key={a.badge}
                className="card-glass card-accent-top card-surface-hover flex flex-col p-6"
                style={{ '--card-gradient': a.gradient }}
              >
                <div className="flex items-center justify-between">
                  <span className="badge badge-accent">{a.badge}</span>
                  <span className="text-[12px] font-[600] text-[var(--muted)]">{a.name}</span>
                </div>
                <div className="mt-4 mb-2">
                  <span className="inline-grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <RoleIcon className="h-[16px] w-[16px]" aria-hidden />
                  </span>
                </div>
                <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-[var(--fg-soft)]">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: 'var(--accent-strong)' }}
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
            );
          })}
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
          {!isAuthenticated && (
            <p className="mt-6 text-center text-[13px] text-[var(--muted)]">
              Yours isn&rsquo;t listed yet?{' '}
              <Link to="/request-institution" className="font-[620] text-[var(--accent-strong)] underline-offset-4 hover:underline">
                Request your institution
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- Coming soon */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-center text-[11px] font-[600] uppercase tracking-[0.14em] text-[var(--muted)]">
          On the roadmap
        </p>
        <div className="roadmap-strip mt-6">
          {EXTRAS.map(({ icon: Icon, tag, title, text }) => (
            <div
              key={title}
              className="card-glass card-surface-hover flex-1 items-start gap-4 p-6"
              style={{ minWidth: '240px' }}
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
      <section className="app-canvas relative isolate overflow-hidden border-t border-[var(--border)]">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="hero-dots pointer-events-none absolute inset-0 -z-10 opacity-50"
        />
        <div className="cta-glow relative mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 lg:py-20">
          <h2 className="text-[34px] font-[650] leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
            Get grounded answers from materials your students can actually access.
          </h2>
          <p className="mx-auto mt-4 max-w-[60ch] text-[15px] leading-relaxed text-[var(--muted)]">
            Every answer cites the slide, page or passage it came from — and content never leaks between institutions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Button size="lg" asChild>
                <Link to="/dashboard">
                  Open your workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Get started free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#institutions">
                    Browse universities
                  </a>
                </Button>
              </>
            )}
          </div>
          <p className="mt-8 text-[12px] text-[var(--muted)]">
            Multi-tenant · Built as an ATBU Faculty of Computing case study · Open for collaboration
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
