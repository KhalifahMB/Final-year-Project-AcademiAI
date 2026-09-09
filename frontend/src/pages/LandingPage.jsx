import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  BookOpenCheck,
  Bot,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  GraduationCap,
  Landmark,
  ListChecks,
  Megaphone,
  Palette,
  Paperclip,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
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

const AGENTS = [
  {
    avatar: '/avatars/tutor.svg',
    role: 'Student · Study partner',
    name: 'Understand more, nail every deadline.',
    text: 'Explains concepts at your level, diagnoses weak points behind wrong answers, and turns a vague goal into a plan with milestones and tasks — always citing the material you are authorised to see.',
    icon: UserRound,
  },
  {
    avatar: '/avatars/librarian.svg',
    role: 'Lecturer · Course co-pilot',
    name: 'Prep, teach, know your class.',
    text: 'Structures lectures and office hours, orders deadlines, flags conflicts, and answers “who needs attention” — grounded in quiz results, progress, and what students actually ask.',
    icon: BookOpen,
  },
  {
    avatar: '/avatars/exec.svg',
    role: 'Administrator · Institution operator',
    name: 'Run the institution smoothly.',
    text: 'Instrument-wide views of analytics, calendars, schedules, users, and logs — with a single actionable take on the day and an eye on what needs human attention.',
    icon: ShieldCheck,
  },
];

const PLANNER = [
  {
    icon: ListChecks,
    title: 'Plans with milestones & tasks',
    text: 'Each plan holds dated milestones and tasks with estimated minutes — study plans, workflows, or personal goals, tracked to a target date.',
  },
  {
    icon: Sparkles,
    title: 'Start from a template… or from a chat',
    text: 'Pick an institution or personal template and instantiate it, or simply ask your agent to turn a goal into a plan with milestones and tasks.',
  },
  {
    icon: CalendarClock,
    title: 'Everything lands on the calendar',
    text: 'Dated plans and milestones sync to your personal study layer automatically — and events you add there flow straight back into your plans.',
  },
];

const CALENDAR_LAYERS = [
  {
    icon: UserRound,
    title: 'Personal',
    text: 'Study plans and milestones render as all-day events on your own layer.',
  },
  {
    icon: BookOpen,
    title: 'Academic',
    text: 'Lectures for the course offerings you are enrolled in or assigned to teach.',
  },
  {
    icon: CalendarClock,
    title: 'Exams',
    text: 'The exam timetable, slotted into the same view as your study plan.',
  },
  {
    icon: Clock,
    title: 'Office hours',
    text: 'When lecturers are available — visible to students and staff alike.',
  },
  {
    icon: Landmark,
    title: 'Institution',
    text: 'University-wide events published by administrators, broadcast to everyone.',
  },
];

const PLATFORM_DEPTH = [
  {
    icon: TrendingUp,
    title: 'Cohort analytics',
    text: 'Per-offering analytics give lecturers resource-quality scores, duplicate detection, topic suggestions, and confusion ranked by real usage.',
  },
  {
    icon: Paperclip,
    title: 'Attach files to a chat',
    text: 'Drop a document into a conversation and the agent answers with that file in context.',
  },
  {
    icon: Palette,
    title: 'Make the agent yours',
    text: 'Custom avatars and tone adjustments, plus accessibility-first reading filters.',
  },
  {
    icon: BookOpenCheck,
    title: 'Resume where you left off',
    text: 'Reading positions remember your scroll position and section in every resource.',
  },
  {
    icon: Landmark,
    title: 'Request your institution',
    text: 'Not listed in the directory? Submit a request and get an auto-provisioned workspace once approved.',
  },
  {
    icon: Megaphone,
    title: 'Institution announcements',
    text: 'University-wide announcements with email dispatch and per-user opt-out.',
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
            <a href="#agent">Personal agent</a>
            <a href="#planner">Study planner</a>
            <a href="#calendar">Calendar</a>
            <a href="#how">How it works</a>
            <a href="#audiences">Who it serves</a>
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
              <h1 className="landing-hero__heading">
                Every answer comes from your institution&rsquo;s own materials.
              </h1>
              <p className="landing-lede">
                AcademiAI gives every university its own AI tutor — grounded
                chat, personalised quizzes and cohort insight from authorised
                materials.
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

        {/* -------------------------------------- What is AcademiAI */}
        <section className="landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <div>
                <h2>A grounded AI tutor for your whole institution.</h2>
              </div>
              <p>
                AcademiAI is a multi-tenant academic assistant. It brings
                classes, materials, planning, and an AI tutor into one
                workspace — every answer grounded in your institution&rsquo;s
                own authorised resources, with no hallucinations and no
                cross-tenant leakage.
              </p>
            </div>
            <div className="landing-manifesto">
              <div className="landing-manifesto__row">
                <span className="landing-manifesto__key">
                  <span>01</span>
                  Chat
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3>Ask anything, get citations.</h3>
                  <p>
                    A personal agent tutors, quizzes, and plans for you — citing
                    the exact page, passage, and document every claim comes
                    from.
                  </p>
                </div>
              </div>
              <div className="landing-manifesto__row">
                <span className="landing-manifesto__key">
                  <span>02</span>
                  Plan
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3>Turn goals into progress.</h3>
                  <p>
                    Study plans, workflows, and personal goals — milestones and
                    tasks, from a template or straight out of a chat.
                  </p>
                </div>
              </div>
              <div className="landing-manifesto__row">
                <span className="landing-manifesto__key">
                  <span>03</span>
                  Calendar
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3>One calendar for study and schedule.</h3>
                  <p>
                    Lectures, exams, office hours, institution events, and your
                    own study plans in a single layered view.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------- Product / model */}
        <section id="product" className="landing-section">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <div>
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

        {/* -------------------------------------- Personal agent */}
        <section id="agent" className="landing-agents">
          <div className="landing-shell landing-section">
            <div className="landing-section__heading">
              <div>
                <h2>One agent, built for your role.</h2>
              </div>
              <p>
                Everyone at the institution gets an AI assistant shaped around
                the way they actually work — trained on retrieved, cited
                material, never on guesses.
              </p>
            </div>
            <div className="landing-agents__grid">
              {AGENTS.map(({ avatar, role, name, text, icon: Icon }) => (
                <article key={role} className="landing-agent">
                  <div className="landing-agent__top">
                    <img src={avatar} alt="" aria-hidden="true" />
                    <span>{role}</span>
                  </div>
                  <h3>{name}</h3>
                  <p>{text}</p>
                  <span className="landing-agent__more">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    Built-in tools &amp; actions
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- Planner */}
        <section id="planner" className="landing-planner">
          <div className="landing-shell landing-section">
            <div className="landing-section__heading">
              <div>
                <h2>Turn “I should study” into a plan.</h2>
              </div>
              <p>
                Plans turn goals into dated milestones and concrete tasks — so
                &ldquo;prepare for the exam&rdquo; becomes a sequence you can
                actually follow.
              </p>
            </div>
            <div className="landing-extras-row">
              {PLANNER.map(({ icon: Icon, title, text }) => (
                <div key={title} className="landing-extra">
                  <Icon className="landing-extra__icon" aria-hidden="true" />
                  <div>
                    <p className="landing-extra__title">{title}</p>
                    <p className="landing-extra__text">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- Calendar */}
        <section id="calendar" className="landing-calendar">
          <div className="landing-shell landing-section">
            <div className="landing-section__heading">
              <div>
                <h2>Study plans, lectures, exams — in one place.</h2>
              </div>
              <p>
                Switch between month, week, day, and agenda views; layer study
                plans over the real academic timetable. Export to ICS, or import
                your timetable as CSV or XLSX with a preview before it lands.
              </p>
            </div>
            <div className="landing-calendar__layers">
              {CALENDAR_LAYERS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="landing-calendar__layer">
                  <Icon className="landing-extra__icon" aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ Platform depth */}
        <section className="landing-depth">
          <div className="landing-shell landing-depth__grid">
            <div className="landing-depth__intro">
              <h2>Beyond the headline.</h2>
              <p>
                In-chat files, resume-reading, cohort analytics, and
                institution requests that actually get provisioned.
              </p>
            </div>
            <ul className="landing-depth__list">
              {PLATFORM_DEPTH.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------- Audiences */}
        <section id="audiences" className="landing-audiences">
          <div className="landing-shell landing-section">
            <div className="landing-section__heading">
              <div>
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
              <h2>Find your university.</h2>
              <p className="landing-data-note">
                Each university gets its own private workspace. Browse the
                directory and join yours in under a minute.
              </p>
              <a className="landing-text-link" href="#institutions">
                Browse all institutions
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <Link
                to="/request-institution"
                className="landing-text-link"
              >
                Don&rsquo;t see yours? Request it
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
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
              <h2>One platform, every faculty and university.</h2>
              <p>
                AcademiAI is architected as a multi-tenant solution — each
                institution gets an isolated workspace with its own courses,
                materials and AI. Designed to start with a single faculty and
                grow across departments, faculties and the whole university.
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
