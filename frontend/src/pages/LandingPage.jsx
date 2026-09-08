import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Bot,
  Check,
  GraduationCap,
  Landmark,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';

const CORE_FEATURES = [
  {
    icon: Bot,
    label: '01 / Retrieve',
    title: 'Tutoring with receipts.',
    text: 'Ask in plain language; answers retrieve from course materials you are authorised to see and every claim carries its chunk, page and similarity score.',
  },
  {
    icon: TrendingUp,
    label: '02 / Practice',
    title: 'Quizzes from your slides.',
    text: 'Lecturers queue the AI against chosen materials, review generated drafts, then publish. Attempts flow straight into mastery records.',
  },
  {
    icon: ShieldCheck,
    label: '03 / Govern',
    title: 'Cohort signals, early.',
    text: 'Concept confusion surfaces while the term can still be steered — ranked by quiz results and what students actually ask the tutor.',
  },
];

const SECONDARY_FEATURES = [
  {
    icon: Bookmark,
    t: 'Bookmarks & notes',
    d: 'A personal learning space that follows you across every course.',
  },
  {
    icon: BookOpen,
    t: 'Smart summaries',
    d: 'Concise digests of lecture material — one tap away.',
  },
  {
    icon: ShieldCheck,
    t: 'Tenant isolation',
    d: 'Database-level RLS keeps each university private.',
  },
];

const HOW_STEPS = [
  [
    '01',
    'Create your institution space',
    'Your university gets its own tenant, academic hierarchy, roles, and access rules.',
  ],
  [
    '02',
    'Bring the material in',
    'Lecturers upload notes, slides, and PDFs. The pipeline chunks and indexes them asynchronously.',
  ],
  [
    '03',
    'Learn from the source',
    'Students chat, practise, and review with answers tied back to real pages and passages.',
  ],
];

const AUDIENCES = [
  {
    label: 'Students',
    title: 'Learn with receipts.',
    text: 'Grounded answers with page-level citations, practice sets from your lecture material, and mastery tracking with a review queue.',
    icon: GraduationCap,
  },
  {
    label: 'Lecturers',
    title: 'See the signal early.',
    text: 'Turn authorised resources into reviewed quizzes and spot confusion before assessment day.',
    icon: BookOpen,
  },
  {
    label: 'Administrators',
    title: 'Keep the map yours.',
    text: 'Manage hierarchy, access, resources, and audit trails inside your institution boundary.',
    icon: ShieldCheck,
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

const FEATURES_CHECKLIST = [
  'Citations point to real passages you can open',
  'Concept-level progress tracking as you study',
  'Visibility scopes keep materials within your institution',
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
      <div className="mt-4 grid gap-2" aria-live="polite">
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

function TutorPanel() {
  return (
    <div className="landing-tutor-wrap">
      <div className="landing-tutor">
        <div className="landing-tutor__topline">
          <span className="landing-tutor__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>ACADEMIAI / TUTOR SESSION</span>
          <span className="landing-tutor__online">● ONLINE</span>
        </div>
        <div className="landing-tutor__body">
          <p className="landing-tutor__question">
            &gt; Explain why this algorithm is O(n log n).
          </p>
          <div className="landing-tutor__answer">
            The divide-and-conquer steps split the input into logarithmic
            levels, while each level processes all n items once. Together, that
            produces n log n work.
          </div>
          <span className="landing-tutor__citation">
            SOURCE / Algorithms-lecture-03.pdf / p.18 / 0.94
          </span>
        </div>
      </div>
      <div className="landing-tutor__caption">
        <Check className="h-4 w-4" aria-hidden="true" />
        <span>
          Every useful answer can take you back to the page it came from.
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const countQuery = useQuery({
    queryKey: ['landing-directory-count'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/');
      return Array.isArray(data.results) ? data.results : [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  const institutionCount = countQuery.data?.length ?? 0;

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
            <a href="#model">The model</a>
            <a href="#institutions">Institutions</a>
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
                  <Link to="/signup">
                    Get started{' '}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
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
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Academic intelligence, with provenance
              </p>
              <h1 className="landing-hero__heading">
                Every answer comes from your institution&rsquo;s own materials.
              </h1>
              <p className="landing-lede">
                AcademiAI gives every university its own AI tutor. Students
                access, understand and excel with their course materials through
                intelligent chat, personalised quizzes and cohort insight — all
                grounded in authorised resources.
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
                      <Link to="/signup">
                        Create account
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <a className="landing-text-link" href="#institutions">
                      Find your university
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
              <div className="landing-proofline">
                <span>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Live implementation
                </span>
                <span>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Secure &amp; tenant-isolated
                </span>
                <span>
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                  Scales to any faculty
                </span>
              </div>
            </div>

            <div>
              <TutorPanel />
            </div>
          </div>
        </section>

        {/* ------------------------------------------- Signal bar */}
        <section id="model" className="landing-signal-bar">
          <div className="landing-shell landing-signal-bar__inner">
            <div>
              <strong>Grounded</strong>
              <span>
                Answers cite the source material you are authorised to see.
              </span>
            </div>
            <div>
              <strong>Reviewed</strong>
              <span>Quizzes are drafted by AI, reviewed, then published.</span>
            </div>
            <div>
              <strong className="landing-live">
                <i aria-hidden="true" />
                {institutionCount > 0 ? `${institutionCount} live` : 'Live'}
              </strong>
              <span>University tenants running AcademiAI today.</span>
            </div>
          </div>
        </section>

        {/* ----------------------------------------- Product / model */}
        <section id="product" className="landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <div>
                <p className="landing-eyebrow">The model</p>
                <h2>Your complete academic assistant.</h2>
              </div>
              <p>
                Designed for universities to provide grounded AI assistance to
                their students — every answer traced to authorised course
                materials in your university&rsquo;s tenant.
              </p>
            </div>
            <div className="landing-principles">
              {CORE_FEATURES.map(({ icon: Icon, label, title, text }) => (
                <article key={title} className="landing-principle">
                  <div className="landing-principle__top">
                    <span>{label}</span>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <div className="landing-extras-row">
              {SECONDARY_FEATURES.map(({ icon: Icon, t, d }) => (
                <div key={t} className="landing-extra">
                  <Icon className="landing-extra__icon" aria-hidden="true" />
                  <div>
                    <p className="landing-extra__title">{t}</p>
                    <p className="landing-extra__text">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- Collaboration */}
        <section className="landing-photo-band">
          <div className="landing-shell landing-photo-band__inner">
            <img
              src="/images/holographic_ai_library_collaboration.webp"
              alt="Students collaborating with an AI assistant inside a digital library"
              loading="lazy"
            />
            <div>
              <p className="landing-eyebrow">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                One workspace per university
              </p>
              <h2>Grounded answers, one cohort at a time.</h2>
              <p>
                Answers are scoped to materials the student is actually enrolled
                to see — your university&rsquo;s content never leaks between
                tenants. Students, lecturers, and admins all work from a single
                isolated workspace.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- How it works */}
        <section id="how" className="landing-how">
          <div className="landing-shell landing-how__grid">
            <div>
              <p className="landing-eyebrow">How it works</p>
              <h2>A multi-tenant architecture for every university.</h2>
              <p className="landing-how__intro">
                Each institution gets an isolated workspace where faculties,
                departments, courses, roles, and permissions stay private —
                scalable to any faculty or department.
              </p>
            </div>
            <ol className="landing-how__steps">
              {HOW_STEPS.map(([n, title, text]) => (
                <li key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------- Knowledge showcase */}
        <section className="landing-knowledge">
          <div className="landing-shell landing-knowledge__grid">
            <div className="landing-knowledge__image">
              <img
                src="/images/ai_knowledge_graph_visualization.webp"
                alt="Knowledge graph connecting course concepts"
                loading="lazy"
              />
            </div>
            <div className="landing-knowledge__copy">
              <p className="landing-eyebrow">
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                Under the hood
              </p>
              <h2>A knowledge graph behind every answer.</h2>
              <p>
                Uploaded documents are chunked, embedded and linked into a
                concept map of your curriculum. When you ask a question,
                AcademiAI retrieves the exact passages and cites them — never a
                hallucinated reference.
              </p>
              <ul>
                {FEATURES_CHECKLIST.map((t) => (
                  <li key={t}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- Audiences */}
        <section id="audiences" className="landing-audiences">
          <div className="landing-shell landing-section">
            <div className="landing-section__heading">
              <div>
                <p className="landing-eyebrow">Who it serves</p>
                <h2>Pick a seat and walk through it.</h2>
              </div>
              <p>
                AcademiAI is built for three working roles on day one — students
                learning, lecturers teaching, and administrators governing.
              </p>
            </div>
            <div className="landing-audiences__grid">
              {AUDIENCES.map(({ icon: Icon, label, title, text }) => (
                <article key={label} className="landing-audience">
                  <div className="landing-audience__top">
                    <span>{label}</span>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- Institutions */}
        <section id="institutions" className="landing-directory-section">
          <div className="landing-shell landing-directory-section__grid">
            <div>
              <p className="landing-eyebrow">Universities</p>
              <h2>Find your university.</h2>
              <p className="landing-data-note">
                Each university gets its own private workspace. Browse the
                directory and join yours in under a minute.
              </p>
              <a className="landing-text-link" href="#institutions">
                Browse all institutions
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <div>
              <LiveDirectory />
            </div>
          </div>
        </section>

        {/* --------------------------------------------- On the roadmap */}
        <section className="landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <div>
                <p className="landing-eyebrow">On the roadmap</p>
                <h2>Coming next.</h2>
              </div>
              <p>
                The platform is built to grow with each university — starting
                with the features below.
              </p>
            </div>
            <div className="landing-extras-row">
              {EXTRAS.map(({ icon: Icon, tag, title, text }) => (
                <article key={title} className="landing-extra">
                  <div className="landing-extra__top">
                    <span className="landing-extra__tag">{tag}</span>
                    <Icon className="landing-extra__icon" aria-hidden="true" />
                  </div>
                  <h3 className="landing-extra__title">{title}</h3>
                  <p className="landing-extra__text">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Multi-tenant */}
        <section id="case-study" className="landing-case-study">
          <div className="landing-shell landing-case-study__inner">
            <div>
              <p className="landing-eyebrow">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                Built for any institution
              </p>
              <h2>One platform, every faculty and university.</h2>
              <p>
                AcademiAI is architected as a multi-tenant solution — each
                institution gets an isolated workspace with its own courses,
                materials and AI. Designed to start with a single faculty and
                scale seamlessly across departments, faculties and the whole
                university.
              </p>
            </div>
            <div className="landing-case-study__stamp" aria-hidden="true">
              <span>v1</span>
              <small>Multi-tenant · Isolated workspaces</small>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- CTA */}
        <section className="landing-cta">
          <div className="landing-shell landing-cta__inner">
            <p className="landing-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Get started
            </p>
            <h2>
              Get grounded answers from your university&rsquo;s materials.
            </h2>
            <p>
              Every answer cites the slide, page or passage it came from — and
              content never leaks between institutions.
            </p>
            <div className="landing-actions">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link to="/dashboard">
                    Open your workspace
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link to="/signup">
                      Get started free
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <a className="landing-text-link" href="#institutions">
                    Browse universities
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </>
              )}
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
          <span>
            © {new Date().getFullYear()} — Multi-tenant academic AI · open for collaboration
          </span>
        </div>
      </footer>
    </div>
  );
}
