import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

const PRINCIPLES = [
  {
    label: '01 / Retrieve',
    title: 'Ask the material.',
    text: 'Answers use the resources your role and course permissions make relevant.',
    icon: Bot,
  },
  {
    label: '02 / Practice',
    title: 'Turn gaps into reps.',
    text: 'Generate quizzes from selected material, then publish only after review.',
    icon: BookOpen,
  },
  {
    label: '03 / Govern',
    title: 'Keep the signal yours.',
    text: 'Institutions control structure, access, resources, and audit trails.',
    icon: ShieldCheck,
  },
];

const AUDIENCES = [
  {
    label: 'Students',
    title: 'Learn with receipts.',
    text: 'Ask questions, practise weak concepts, and keep your notes close to the material.',
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

const HOW_IT_WORKS = [
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

function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.22, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

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
    <div className="landing-directory">
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
                <small>/{institution.slug}</small>
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
  const directoryQuery = useQuery({
    queryKey: ['landing-directory-count'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/');
      return Array.isArray(data.results) ? data.results : [];
    },
    staleTime: 60_000,
    retry: 1,
  });
  const institutionCount = directoryQuery.data?.length;

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
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy landing-reveal">
              <p className="landing-eyebrow">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Academic
                intelligence, with provenance
              </p>
              <h1 className="text-wrap-balance">Study from what your university knows.</h1>
              <p className="landing-lede">
                AcademiAI turns authorised course material into a tutor,
                practice room, and progress signal your institution can trust.
              </p>
              <div className="landing-actions">
                <Button size="lg" asChild>
                  <Link to={isAuthenticated ? '/dashboard' : '/signup'}>
                    {isAuthenticated ? 'Open workspace' : 'Start learning'}{' '}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <a className="landing-text-link" href="#model">
                  See how it works{' '}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="landing-proofline">
                <span>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />{' '}
                  Tenant-isolated
                </span>
                <span>
                  <GraduationCap className="h-4 w-4" aria-hidden="true" /> Built
                  for universities
                </span>
              </div>
            </div>
            <Reveal
              className="landing-reveal landing-reveal--delay"
              delay={0.12}
            >
              <div className="relative">
                <TutorPanel />
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent/10 blur-3xl rounded-full -z-10" />
              </div>
            </Reveal>
          </div>
        </section>

        <section
          className="landing-signal-bar"
          aria-label="Live platform signals"
        >
          <div className="landing-shell landing-signal-bar__inner">
            <div>
              <strong>
                {directoryQuery.isLoading ? '—' : (institutionCount ?? '—')}
              </strong>
              <span>active institutions in the live directory</span>
            </div>
            <div>
              <strong>RLS</strong>
              <span>isolation at the database layer</span>
            </div>
            <div>
              <strong className="landing-live">
                <i />{' '}
                {directoryQuery.isError
                  ? 'API unavailable'
                  : 'Directory connected'}
              </strong>
              <span>live platform status</span>
            </div>
          </div>
        </section>

        <section className="landing-section" id="model">
          <div className="landing-shell">
            <div className="landing-section__heading">
              <div>
                <p className="landing-eyebrow">The operating model</p>
                <h2>Useful by design. Verifiable by default.</h2>
              </div>
              <p>
                Students need clarity, lecturers need signal, and administrators
                need control. Each role gets a focused path through the same
                trusted institutional knowledge base.
              </p>
            </div>
            <div className="landing-principles">
              {PRINCIPLES.map(({ label, title, text, icon: Icon }, index) => (
                <motion.article
                  key={label}
                  className="landing-principle"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.22, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="landing-principle__top">
                    <span>{label}</span>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-audiences" id="audiences">
          <div className="landing-shell">
            <Reveal>
              <div className="landing-section__heading">
                <div>
                  <p className="landing-eyebrow">
                    One platform, three perspectives
                  </p>
                  <h2>Built around the people doing the work.</h2>
                </div>
                <p>
                  Learning is shared, but the day-to-day needs are different.
                  AcademiAI gives every role a clear path without breaking the
                  institutional context.
                </p>
              </div>
            </Reveal>
            <div className="landing-audiences__grid">
              {AUDIENCES.map(({ label, title, text, icon: Icon }, index) => (
                <motion.article
                  key={label}
                  className="landing-audience"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.22, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="landing-audience__top">
                    <span>{label}</span>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-how" id="how">
          <div className="landing-shell landing-how__grid">
            <Reveal>
              <p className="landing-eyebrow">How it works</p>
              <h2>From scattered files to a shared academic memory.</h2>
              <p className="landing-how__intro">
                A secure, asynchronous pipeline keeps the institution’s
                knowledge useful without asking staff to change how they
                organise their courses.
              </p>
            </Reveal>
            <ol className="landing-how__steps">
              {HOW_IT_WORKS.map(([number, title, text], index) => (
                <motion.li
                  key={number}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.1 }}
                >
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-photo-band">
          <div className="landing-shell landing-photo-band__inner">
            <img
              src="/images/holographic_ai_library_collaboration.webp"
              alt="Students collaborating with an AI assistant in a digital library"
              loading="lazy"
            />
            <div>
              <p className="landing-eyebrow">One workspace per university</p>
              <h2>Grounded answers, one cohort at a time.</h2>
              <p>
                Resources, quizzes, notes, and progress stay connected while
                each institution keeps control of its own materials.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-knowledge">
          <div className="landing-shell landing-knowledge__grid">
            <Reveal className="landing-knowledge__image">
              <img
                src="/images/ai_knowledge_graph_visualization.webp"
                alt="A concept graph connecting academic topics and source material"
                loading="lazy"
              />
            </Reveal>
            <Reveal className="landing-knowledge__copy" delay={0.1}>
              <p className="landing-eyebrow">Under the hood</p>
              <h2>A knowledge graph behind every useful answer.</h2>
              <p>
                Documents are chunked, embedded, and linked into a concept map
                of your curriculum. When a student asks a question, the system
                can retrieve the relevant passage and show its source.
              </p>
              <ul>
                <li>
                  <Check className="h-4 w-4" aria-hidden="true" /> Citations
                  point to real passages.
                </li>
                <li>
                  <Check className="h-4 w-4" aria-hidden="true" /> Concept
                  progress follows the learner.
                </li>
                <li>
                  <Check className="h-4 w-4" aria-hidden="true" /> Visibility
                  rules stay institution-aware.
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="landing-directory-section" id="institutions">
          <div className="landing-shell landing-directory-section__grid">
            <div>
              <p className="landing-eyebrow">Live institution index</p>
              <h2>Find your place in the workspace.</h2>
              <p>
                The directory below is sourced from the AcademiAI API. No sample
                institutions are embedded in this page.
              </p>
              <Link className="landing-text-link" to="/request-institution">
                Request your institution{' '}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <LiveDirectory />
          </div>
        </section>

        <section className="landing-case-study">
          <div className="landing-shell landing-case-study__inner">
            <Reveal>
              <p className="landing-eyebrow">Initial implementation</p>
              <h2>
                Designed as an ATBU Faculty of Computing case study, ready for
                every university.
              </h2>
              <p>
                AcademiAI is being developed for Abubakar Tafawa Balewa
                University, Bauchi. The first implementation grounds the
                platform in real academic structure while keeping the
                architecture ready for any faculty, course, or institution.
              </p>
            </Reveal>
            <div className="landing-case-study__stamp" aria-hidden="true">
              <span>ATBU</span>
              <small>
                FACULTY OF COMPUTING
                <br />
                CASE STUDY
              </small>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <Reveal className="landing-cta__inner">
            <p className="landing-eyebrow">Start with the source</p>
            <h2>Give your university an AI tutor it can stand behind.</h2>
            <p>
              Students get clearer answers. Lecturers get earlier signals.
              Administrators keep the institution’s knowledge and access under
              control.
            </p>
            <div className="landing-actions">
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className={cn(buttonVariants({ size: 'lg' }))}
              >
                {isAuthenticated ? 'Open workspace' : 'Create an account'}{' '}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link className="landing-text-link" to="/request-institution">
                Request your institution{' '}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__inner">
          <Link to="/" className="landing-brand">
            <BrandMark size="h-7 w-7" />
            <span>AcademiAI</span>
          </Link>
          <span>Grounded learning, institution by institution.</span>
        </div>
      </footer>
    </div>
  );
}
