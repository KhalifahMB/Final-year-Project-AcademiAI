import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  ListChecks,
  Lock,
  Megaphone,
  Quote,
  Rss,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import api, { publicApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { FragmentedMaterialsPlate } from '@/components/shared/landingPlates';
import { Button } from '@/components/ui/button';

const PROBLEMS = [
  {
    icon: FileText,
    title: 'Materials live in a dozen drives',
    text: 'Slide decks, notes, past papers and PDFs sit split across departments and folders — there is no single place to ask.',
  },
  {
    icon: Bot,
    title: 'Generic answers, zero receipts',
    text: 'General-purpose chatbots answer plausibly but never point back to your university\u2019s actual materials.',
  },
  {
    icon: TrendingUp,
    title: 'Confusion hides until the exam',
    text: 'You only discover what a cohort actually missed long after the deadline has passed.',
  },
];

const FEATURES = [
  {
    icon: Bot,
    title: 'Grounded chat',
    text: 'Every answer retrieves from authorised materials and cites the exact page and passage it came from.',
  },
  {
    icon: UserRound,
    title: 'Role agents',
    text: 'A dedicated agent per working role — student study partner, lecturer co-pilot, admin operator.',
  },
  {
    icon: ListChecks,
    title: 'Study planner',
    text: 'A vague goal becomes milestones and dated tasks you can actually follow.',
  },
  {
    icon: Calendar,
    title: 'Layered calendar',
    text: 'Lectures, exams, office hours and your study plan in one layered view.',
  },
  {
    icon: BookOpenCheck,
    title: 'Quizzes from your slides',
    text: 'Drafted by the AI, reviewed by lecturers, then published — attempts feed mastery records.',
  },
  {
    icon: TrendingUp,
    title: 'Cohort signals',
    text: 'Concept confusion ranked by quiz results and real student questions — while the term can still be steered.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Upload & parse',
    text: 'Lecturers bring in notes, slides and PDFs. The pipeline chunks and embeds them asynchronously.',
  },
  {
    num: '02',
    title: 'Index & isolate',
    text: 'Vectors land in a per-tenant index. Row-level security keeps every institution private.',
  },
  {
    num: '03',
    title: 'Cite & answer',
    text: 'Questions retrieve, rerank and answer — with the page, passage and score openable behind every claim.',
  },
];

const ISOLATION_POINTS = [
  'Row-level security enforced at the database layer',
  'Per-tenant pgvector HNSW index',
  'Region-pinned storage and tenant-scoped app queries',
  'Every read leaves an audit trail',
];

const TENANTS = [
  {
    name: 'TENANT_A',
    domain: 'uniben.edu.ng',
    tag: 'RLS enforced',
    active: true,
    meta: ['pgvector · hnsw', 'region eu-west-1', 'tenant_id t_9f1c'],
  },
  {
    name: 'TENANT_B',
    domain: 'parakou.bj',
    tag: 'RLS enforced',
    active: false,
    meta: ['pgvector · hnsw', 'region eu-west-1'],
  },
  {
    name: 'TENANT_C',
    domain: 'eneam.bj',
    tag: 'RLS enforced',
    active: false,
    meta: ['pgvector · hnsw', 'region eu-west-1'],
  },
];

const ROLES = [
  {
    icon: GraduationCap,
    label: 'Student · Study partner',
    title: 'Understand more, nail every deadline.',
    text: 'Explains concepts at your level, diagnoses the weak points behind wrong answers, and turns a vague goal into a plan — always citing the material you are authorised to see.',
  },
  {
    icon: BookOpen,
    label: 'Lecturer · Course co-pilot',
    title: 'Prep, teach, know your class.',
    text: 'Structures lectures and office hours, orders deadlines, flags conflicts, and answers \u201cwho needs attention\u201d — grounded in quiz results and what students actually ask.',
  },
  {
    icon: ShieldCheck,
    label: 'Admin · Institution operator',
    title: 'Run the institution smoothly.',
    text: 'Instrument-wide views of analytics, calendars, schedules, users and logs — with a single actionable take on the day.',
  },
];

const SIGNALS = [
  {
    icon: Rss,
    title: 'Concept confusion',
    text: 'Ranked by quiz results and the questions students actually put to the tutor.',
    bars: [2, 3, 4, 6, 8, 7, 9, 10],
  },
  {
    icon: FileText,
    title: 'Coverage gaps',
    text: 'Resources that are rarely accessed — or missing the context a question keeps needing.',
    bars: [8, 6, 5, 4, 4, 2, 1, 1],
  },
  {
    icon: Megaphone,
    title: 'Early warning',
    text: 'Signals reach the lecturer while the term can still be steered, not after marks.',
    bars: [1, 1, 2, 4, 5, 7, 9, 10],
  },
];

const TESTIMONIALS = [];

const FAQS = [
  {
    q: 'Where do answers actually come from?',
    a: 'Every answer is grounded in your institution\u2019s own authorised resources — slides, notes, and PDFs uploaded by lecturers. Retrieval returns exact passages, and each claim carries the document, page, and score you can open and check.',
  },
  {
    q: 'Is our content kept private between universities?',
    a: 'Yes. Each institution runs in its own isolated tenant, enforced at the database layer with row-level security and then at the application layer on every query. Content from one university can never surface in another tenant\u2019s answers.',
  },
  {
    q: 'Who gets to see and use what?',
    a: 'Students, lecturers, and administrators each get a role-shaped workspace with a dedicated agent. Visibility scopes keep materials inside your institution, and administrators control access, announcements, and the audit trail.',
  },
  {
    q: 'Does setting this up need our IT team?',
    a: 'No on-premises infrastructure. Request your institution and, once approved, you receive an auto-provisioned workspace with its own academic hierarchy, roles, and access rules — ready to add material to.',
  },
  {
    q: 'Can we bring in our existing timetable?',
    a: 'Yes. Upload it as CSV or XLSX, review the parsed matrix in a preview step, then commit — lectures, exams, and office hours land on the calendar. Any view can also be exported to ICS.',
  },
  {
    q: 'What does it cost to start?',
    a: 'Free to start for students — create an account and join your university\u2019s workspace. Institutions are provisioned on request, and plan tiers are being finalised, so ask and we\u2019ll confirm the details.',
  },
];

function LiveDirectory() {
  const [search, setSearch] = useState('');
  const query = search.trim();

  const directoryQuery = useQuery({
    queryKey: ['landing-directory', query],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/', {
        params: query ? { search: query } : {},
      });
      return Array.isArray(data.results) ? data.results : [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  const institutions = directoryQuery.data || [];

  return (
    <div>
      <label className="landing-search">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Search active institutions</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your university"
          aria-label="Search active institutions"
        />
      </label>
      <div className="mt-4 grid gap-1" aria-live="polite">
        {directoryQuery.isLoading ? (
          <p className="landing-data-note">
            Loading the live institution directory...
          </p>
        ) : directoryQuery.isError ? (
          <p className="landing-data-note landing-data-note--error">
            The institution directory is unavailable right now.
          </p>
        ) : institutions.length === 0 ? (
          <p className="landing-data-note">
            {query
              ? 'No active institution matches that search.'
              : 'No active institutions are listed yet.'}
          </p>
        ) : (
          institutions.slice(0, 6).map((institution) => (
            <Link
              key={institution.id}
              to="/signup"
              className="landing-institution"
            >
              <span className="landing-institution__mark" aria-hidden="true">
                {(institution.name || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <strong>{institution.name}</strong>
                <small>{institution.slug}</small>
              </span>
              <span className="landing-institution__join">Join</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function GroundedChatMock() {
  return (
    <div className="landing-hero__mock">
      <div className="hero-live-badge" aria-hidden="true">
        <i />
        RLS-scoped
      </div>
      <div className="chat-window">
        <div className="chat-window__bar">
          <span className="chat-window__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>GROUNDED CHAT</span>
          <span className="chat-window__status">● ONLINE</span>
        </div>
        <div className="chat-window__body">
          <p className="chat-msg chat-msg--user">
            &gt; Why does this algorithm run in O(n log n)?
          </p>
          <div className="chat-msg chat-msg--ai">
            <p>
              The divide-and-conquer steps split the input into logarithmic
              levels, and each level processes all n items once — together
              that is n log n work.
            </p>
            <span className="chat-cite">
              <BadgeCheck aria-hidden="true" />
              <strong>[1]</strong> Algorithms-lecture-03.pdf · p.18 · sim 0.94
            </span>
            <div className="chat-cite__meta">
              <span className="chat-meta-pill">
                <Check aria-hidden="true" /> retrieved 4 chunks
              </span>
              <span className="chat-meta-pill">reranked</span>
              <span className="chat-meta-pill">verified</span>
            </div>
          </div>
        </div>
        <div className="chat-window__footer">
          <Search aria-hidden="true" />
          <span>Ask about the Thermodynamics Syllabus 2024…</span>
        </div>
      </div>
    </div>
  );
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');

  return (
    <form
      className="landing-request__form"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Request a workspace"
    >
      <div className="grid gap-1.5">
        <label htmlFor="landing-request-email">Work email</label>
        <input
          id="landing-request-email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu.ng"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="landing-request-institution">Institution name</label>
        <input
          id="landing-request-institution"
          type="text"
          autoComplete="organization"
          placeholder="e.g. University of Lagos"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
        />
      </div>
      <Button size="lg" className="mt-1 w-full" asChild>
        <Link to="/request-institution">
          Request workspace
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
      <div className="landing-request__bank">
        <Lock aria-hidden="true" />
        <span>
          Setup is free for early adopters · no card required · your data stays
          in-region.
        </span>
      </div>
    </form>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const statsQuery = useQuery({
    queryKey: ['landing-public-stats'],
    queryFn: publicApi.getStats,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const institutionCount = statsQuery.data?.institutions_total ?? 0;

  const navLinks = [
    { label: 'Product', href: '#solution' },
    { label: 'Security', href: '#security' },
    { label: 'Roles', href: '#roles' },
    { label: 'How it works', href: '#how' },
  ];

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-shell landing-nav__inner">
          <Link to="/" className="landing-brand" aria-label="AcademiAI home">
            <BrandMark size="h-8 w-8" />
            <span>AcademiAI</span>
          </Link>
          <nav
            className="landing-nav__links"
            aria-label="Landing page sections"
          >
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="landing-nav__actions">
            <ThemeToggle className="landing-theme-btn" iconOnly />
            {isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">
                  Open workspace{' '}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  className="landing-auth-secondary"
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button className="landing-auth-primary" size="sm" asChild>
                  <Link to="/request-institution">Request workspace</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------- Hero */}
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div>
              <p className="landing-eyebrow">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Multi-tenant · Grounded · Institution-first
              </p>
              <h1 className="landing-hero__heading">
                Knowledge, <em>cited.</em> Not imagined.
              </h1>
              <p className="landing-lede">
                AcademiAI gives every university its own isolated AI workspace —
                grounded chat, quizzes and cohort insight drawn from the
                institution&rsquo;s own authorised materials, with every claim
                traced back to a page.
              </p>
              <div className="landing-actions">
                {isAuthenticated ? (
                  <Button size="lg" asChild>
                    <Link to="/dashboard">
                      Open workspace
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" asChild>
                      <Link to="/request-institution">
                        Request your workspace
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <a
                      className="landing-text-link"
                      href="#grounding"
                    >
                      See grounding in action
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
            </div>

            <GroundedChatMock />
          </div>
        </section>

        {/* --------------------------------------------- Trust strip */}
        <section className="landing-trust" aria-label="Trusted departments">
          <div className="landing-shell landing-trust__inner">
            <span className="landing-trust__label">Trusted across departments</span>
            <div className="landing-trust__track">
              {institutionCount > 0 && (
                <span className="landing-trust__live">
                  <i aria-hidden="true" />
                  {institutionCount} live
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- Problem section */}
        <section className="landing-problem landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading landing-section__heading--split">
              <div>
                <p className="landing-eyebrow">The problem</p>
                <h2>Materials are fragmented. Answers shouldn&rsquo;t be.</h2>
                <p>
                  Lecturers prepare relentlessly. Students still end up asking a
                  generic chatbot that guesses instead of citing. The result is
                  time lost and answers without receipts.
                </p>
              </div>
              <FragmentedMaterialsPlate data-testid="problem-plate" />
            </div>
            <div className="landing-problem__grid">
              {PROBLEMS.map(({ icon: Icon, title, text }) => (
                <article key={title} className="landing-problem__card">
                  <span className="chat-cite">
                    <Icon aria-hidden="true" />
                    <strong>{title.split(' ')[0]}</strong>
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ Platform section */}
        <section id="solution" className="landing-section landing-product">
          <div className="landing-shell">
            <div className="landing-section__heading landing-section__heading--split">
              <div>
                <p className="landing-eyebrow">The platform</p>
                <h2>One isolated workspace per institution.</h2>
              </div>
              <p>
                Every university runs in its own tenant — with courses, roles,
                materials and an AI assistant shaped around how each working
                role actually learns and teaches.
              </p>
            </div>
            <div className="landing-feature-grid">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="landing-feature">
                  <span className="landing-feature__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- How it works */}
        <section id="how" className="landing-steps landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">How it works</p>
              <h2>From upload to cited answer in three steps.</h2>
              <p>
                No data-science team required — the pipeline parses, isolates
                and serves as soon as material is in.
              </p>
            </div>
            <div className="landing-steps__grid">
              {STEPS.map(({ num, title, text }, i) => (
                <article key={num} className="landing-step">
                  <span className="landing-step__num">{num}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <div
                    className={`landing-step__rail${
                      i === STEPS.length - 1 ? ' landing-step__rail--full' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <i />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------- Isolation */}
        <section id="security" className="landing-isolation landing-section">
          <div className="landing-shell landing-isolation__grid">
            <div className="landing-isolation__copy">
              <p className="landing-eyebrow">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Security
              </p>
              <h2>Hard isolation. Not soft promises.</h2>
              <p>
                Isolation is enforced at the database layer before your
                application code ever runs. One institution&rsquo;s materials
                can never surface in another&rsquo;s answers.
              </p>
              <ul className="landing-isolation__list">
                {ISOLATION_POINTS.map((point) => (
                  <li key={point}>
                    <Check aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="tenant-map" aria-label="Tenant isolation diagram">
              {TENANTS.map((tenant) => (
                <article
                  key={tenant.name}
                  className={`tenant-card${
                    tenant.active ? '' : ' tenant-card--disabled'
                  }`}
                  aria-hidden="true"
                >
                  <div className="tenant-card__top">
                    <span className="tenant-card__name">{tenant.name}</span>
                    <span className="tenant-card__tag">
                      <Lock aria-hidden="true" />
                      {tenant.tag}
                    </span>
                  </div>
                  <div className="tenant-card__meta">
                    <span>{tenant.domain}</span>
                    {tenant.meta.map((meta) => (
                      <span key={meta}>{meta}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------- Grounding in action */}
        <section id="grounding" className="landing-grounding landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading landing-section__heading--split">
              <div>
                <p className="landing-eyebrow">Grounding</p>
                <h2>See the grounding in action.</h2>
              </div>
              <p>
                Ask in plain language. The answer retrieves only what your
                institution authorised, reranks it, and pins every claim to a
                source you can open.
              </p>
            </div>
            <div className="landing-grounding__grid">
              <GroundedChatMock />
              <aside className="sources-rail">
                <div className="sources-rail__head">
                  <span>RETRIEVED SOURCES</span>
                  <span className="sources-rail__count">12 sources</span>
                </div>
                <div className="sources-rail__list">
                  {[
                    ['Algorithms-lecture-03.pdf', '0.94'],
                    ['Thermodynamics Syllabus 2024.pdf', '0.91'],
                    ['DS-drive-notes-v2.pdf', '0.89'],
                    ['Complexity-theory-notes.docx', '0.86'],
                  ].map(([doc, score]) => (
                    <div key={doc} className="source-chip">
                      <div className="source-chip__top">
                        <span className="source-chip__doc">{doc}</span>
                        <span className="source-chip__score">{score}</span>
                      </div>
                      <span className="chat-cite">
                        <BadgeCheck aria-hidden="true" />
                        Page 42 · §3.2 · Verified
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Roles */}
        <section id="roles" className="landing-roles landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">Roles</p>
              <h2>One agent per working role.</h2>
              <p>
                Not one chatbot for everyone — a dedicated assistant shaped
                around how students, lecturers and administrators actually
                work, all inside a single isolated workspace.
              </p>
            </div>
            <div className="landing-roles__grid">
              {ROLES.map(({ icon: Icon, label, title, text }) => (
                <article key={label} className="landing-role">
                  <div className="landing-role__top">
                    <span className="landing-role__avatar">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="landing-role__label">{label}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- Signals */}
        <section className="landing-signals landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">Cohort signals</p>
              <h2>Confusion surfaces early.</h2>
              <p>
                Ranked, per-concept signals reach the lecturer while the term
                can still be steered — not after marks come out.
              </p>
            </div>
            <div className="landing-signals__grid">
              {SIGNALS.map(({ icon: Icon, title, text, bars }) => (
                <article key={title} className="landing-signal">
                  <div className="landing-signal__top">
                    <span>{title}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                  <div className="landing-signal__meter" aria-hidden="true">
                    {bars.map((height, i) => (
                      <i
                        key={i}
                        className={height >= 7 ? 'hot' : ''}
                        style={{ height: `${(height / 10) * 100}%` }}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- Testimonials */}
        <section className="landing-testimonials landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">In the field</p>
              <h2>Built with universities, not for them.</h2>
            </div>
            <div className="landing-testimonials__grid">
              {TESTIMONIALS.map(({ quote, name, role }) => (
                <figure key={name} className="landing-testimonial">
                  <Quote className="h-4 w-4 text-[var(--landing-accent)]" aria-hidden="true" />
                  <blockquote className="landing-testimonial__quote">
                    {quote}
                  </blockquote>
                  <figcaption className="landing-testimonial__foot">
                    <span className="landing-testimonial__name">{name}</span>
                    <span className="landing-testimonial__role">{role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------- Request + live directory */}
        <section id="institutions" className="landing-request landing-section">
          <div className="landing-shell landing-request__grid">
            <div className="landing-request__copy">
              <p className="landing-eyebrow">Get started</p>
              <h2>Turn your university into a workspace.</h2>
              <p>
                Requests are reviewed daily and provisioned in under 48 hours —
                with a private tenant, academic hierarchy, roles and an AI
                grounded in materials your lecturers upload.
              </p>
              <RequestForm />
            </div>
            <aside className="landing-directory">
              <h3>Find your university</h3>
              <p>
                Already running on AcademiAI? Search the live directory and
                join your institution in under a minute.
              </p>
              <LiveDirectory />
              <Link className="landing-text-link" to="/request-institution">
                Don&rsquo;t see yours? Request it
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </section>

        {/* --------------------------------------------------- FAQ */}
        <section id="faq" className="landing-faq landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">FAQ</p>
              <h2>Questions, answered straight.</h2>
            </div>
            <div className="landing-faq__list">
              {FAQS.map((item) => (
                <details key={item.q} className="landing-faq__item">
                  <summary>
                    {item.q}
                    <ChevronDown
                      className="landing-faq__chevron"
                      aria-hidden="true"
                    />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__inner">
          <Link to="/" className="landing-brand">
            <BrandMark size="h-7 w-7" />
            <span>AcademiAI</span>
          </Link>
          <nav className="landing-footer__links" aria-label="Footer">
            <a href="#security">Security</a>
            <a href="#institutions">Institutions</a>
            <a href="#faq">FAQ</a>
            {!isAuthenticated && (
              <Link to="/login">Sign in</Link>
            )}
          </nav>
          <span>
            © {new Date().getFullYear()} AcademiAI · Multi-tenant · Grounded
          </span>
        </div>
      </footer>
    </div>
  );
}