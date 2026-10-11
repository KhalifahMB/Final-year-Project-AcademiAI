import './cinnabar.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  BRAND,
  NAV_LINKS,
  HERO,
  CHAT,
  PROBLEM,
  PLATFORM,
  HOW,
  ISOLATION,
  GROUNDING,
  ROLES,
  SIGNALS,
  COMMITMENTS,
  ROADMAP,
  GET_STARTED,
  FAQ,
  FOOTER,
} from '../content';
import { useLandingStats, useInstitutionDirectory } from '../hooks';
import { useAuth } from '@/hooks/useAuth';
import CinnabarMark from './CinnabarMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';

/* Ingestion telemetry shown beside the hero chat — the pipeline read as a
   log an operator would recognise. Static; the page's one authored motion
   lives on the chat answer. */
const PIPELINE = [
  { t: '+0.00s', op: 'mount', txt: 'tenant workspace' },
  { t: '+0.12s', op: 'load', txt: 'authorised corpus' },
  { t: '+0.38s', op: 'index', txt: 'pgvector · hnsw' },
  { t: '+0.61s', op: 'bind', txt: 'rls · tenant_id' },
  { t: '+0.90s', op: 'ready', txt: 'grounded chat online' },
];

const RETRIEVAL = [
  ['retrieve', '4 passages'],
  ['rerank', 'keep top 4'],
  ['verify', 'in-tenant · cited'],
];

function statusTone(status) {
  if (status === 'In development') return 'warn';
  if (status === 'Next up') return 'accent';
  return 'idle';
}

function SystemBar() {
  return (
    <div className="cb-status">
      <div className="cb-shell cb-status__inner">
        <span className="cb-status__left">
          <Terminal aria-hidden="true" />
          <span>{BRAND.name.toUpperCase()} / CINNABAR</span>
        </span>
        <span className="cb-status__mid">
          <span className="cb-led cb-led--live" aria-hidden="true" />
          {BRAND.tagline}
        </span>
        <span className="cb-status__right">
          <span>RLS:on</span>
          <span aria-hidden="true">·</span>
          <span>pgvector</span>
          <span aria-hidden="true">·</span>
          <span>eu-west-1</span>
        </span>
      </div>
    </div>
  );
}

function TopNav({ isAuthenticated }) {
  return (
    <header className="cb-nav">
      <div className="cb-shell cb-nav__inner">
        <Link to="/" className="cb-brand" aria-label={BRAND.homeLabel}>
          <CinnabarMark size="h-8 w-8" withWordmark />
        </Link>

        <nav className="cb-nav__links" aria-label="Landing sections">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="cb-nav__actions">
          <ThemeToggle className="cb-theme" iconOnly />
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link to={HERO.sessionCta.to}>
                {HERO.sessionCta.label}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <Button className="cb-nav__signin" variant="ghost" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/request-institution">Request workspace</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function GroundedChat({ stream = false }) {
  return (
    <div className="cb-chat">
      <div className="cb-chat__bar">
        <span className="cb-chrome" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="cb-chat__title">{CHAT.bar}</span>
        <span className="cb-chat__state">
          <span className="cb-led cb-led--ok" aria-hidden="true" />
          {CHAT.status}
        </span>
      </div>

      <div className="cb-chat__body">
        <p className="cb-chat__user">
          <span className="cb-prompt" aria-hidden="true">
            {'>'}
          </span>
          {CHAT.question}
        </p>

        <div className="cb-chat__ans">
          <p
            className={`cb-chat__stream${
              stream ? ' cb-chat__stream--run' : ''
            }`}
          >
            {CHAT.answer}
            {stream ? <span className="cb-caret" aria-hidden="true" /> : null}
          </p>

          <span className="cb-chat__cite">
            <BadgeCheck aria-hidden="true" />
            <strong>{CHAT.citation.index}</strong>
            <span>{CHAT.citation.doc}</span>
            <span className="cb-dot" aria-hidden="true">
              ·
            </span>
            <span>{CHAT.citation.page}</span>
            <span className="cb-dot" aria-hidden="true">
              ·
            </span>
            <span>{CHAT.citation.score}</span>
          </span>

          <span className="cb-chat__meta">
            {CHAT.meta.map((item) => (
              <span key={item} className="cb-chip">
                <Check aria-hidden="true" />
                {item}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="cb-chat__foot">
        <span className="cb-prompt" aria-hidden="true">
          {'>'}
        </span>
        <span className="cb-chat__ph">{CHAT.placeholder}</span>
        <span className="cb-chat__badge">{CHAT.badge}</span>
      </div>
    </div>
  );
}

function PipelineLog() {
  return (
    <div className="cb-log" aria-label="Ingestion pipeline log">
      <div className="cb-log__head">
        <Activity aria-hidden="true" />
        <span>pipeline</span>
        <span className="cb-log__state">streaming</span>
      </div>
      <ol className="cb-log__list">
        {PIPELINE.map((row) => (
          <li key={row.op} className="cb-log__row">
            <span className="cb-log__t">{row.t}</span>
            <span className="cb-log__op">{row.op}</span>
            <span className="cb-log__txt">{row.txt}</span>
            <span className="cb-led cb-led--ok" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Hero({ isAuthenticated }) {
  return (
    <section className="cb-hero">
      <div className="cb-shell cb-hero__grid">
        <div className="cb-hero__copy">
          <p className="cb-eyebrow">
            <ShieldCheck aria-hidden="true" />
            {HERO.eyebrow}
          </p>
          <h1 className="cb-hero__title">
            {HERO.headlineLead}
            <em>{HERO.headlineAccent}</em>
            {HERO.headlineTail}
          </h1>
          <p className="cb-lede">{HERO.lede}</p>

          <div className="cb-ctas">
            {isAuthenticated ? (
              <Button size="lg" asChild>
                <Link to={HERO.sessionCta.to}>
                  {HERO.sessionCta.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link to={HERO.primaryCta.to}>
                    {HERO.primaryCta.label}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <a className="cb-link" href={HERO.secondaryCta.href}>
                  {HERO.secondaryCta.label}
                  <ChevronRight aria-hidden="true" />
                </a>
              </>
            )}
          </div>

          <ul className="cb-proof">
            {HERO.proof.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="cb-console">
          <div className="cb-console__bar">
            <span className="cb-console__title">academiai — grounded console</span>
            <span className="cb-console__tag">RLS-scoped</span>
          </div>
          <div className="cb-console__body">
            <GroundedChat stream />
            <PipelineLog />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const count = useLandingStats();
  return (
    <section className="cb-trust" aria-label="Live platform figures">
      <div className="cb-shell cb-trust__inner">
        <span className="cb-trust__label">
          <Activity aria-hidden="true" />
          Trusted across departments
        </span>
        <span className="cb-trust__stats">
          <span className="cb-trust__stat">
            <span className="cb-led cb-led--live" aria-hidden="true" />
            {String(count).padStart(2, '0')} institutions live
          </span>
          <span className="cb-trust__fact">RLS · pgvector/hnsw · audited reads</span>
        </span>
      </div>
    </section>
  );
}

function Panel({ id, tag, children }) {
  return (
    <div className="cb-shell">
      <section id={id} className="cb-panel">
        <header className="cb-panel__bar">
          <span className="cb-panel__tag">{tag}</span>
          <span className="cb-panel__line" aria-hidden="true" />
        </header>
        <div className="cb-panel__body">{children}</div>
      </section>
    </div>
  );
}

function Head({ eyebrow, title, sub }) {
  return (
    <header className="cb-head">
      <p className="cb-eyebrow">{eyebrow}</p>
      <h2 className="cb-h2">{title}</h2>
      {sub ? <p className="cb-sub">{sub}</p> : null}
    </header>
  );
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const form = GET_STARTED.form;

  return (
    <form
      className="cb-form"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Request a workspace"
    >
      <div className="cb-field">
        <label htmlFor="cb-email">{form.emailLabel}</label>
        <input
          id="cb-email"
          type="email"
          autoComplete="email"
          placeholder={form.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="cb-field">
        <label htmlFor="cb-institution">{form.institutionLabel}</label>
        <input
          id="cb-institution"
          type="text"
          autoComplete="organization"
          placeholder={form.institutionPlaceholder}
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
        />
      </div>
      <Button size="lg" className="cb-form__submit" asChild>
        <Link to="/request-institution">
          {form.submitLabel}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <p className="cb-form__note">
        <Lock aria-hidden="true" />
        {form.note}
      </p>
    </form>
  );
}

function Directory() {
  const [search, setSearch] = useState('');
  const directory = useInstitutionDirectory(search);
  const dir = GET_STARTED.directory;
  const institutions = directory.data || [];

  let body;
  if (directory.isLoading) {
    body = <p className="cb-dir__note">{dir.loading}</p>;
  } else if (directory.isError) {
    body = <p className="cb-dir__note cb-dir__note--error">{dir.error}</p>;
  } else if (institutions.length === 0) {
    body = (
      <p className="cb-dir__note">
        {search.trim() ? dir.emptySearch : dir.empty}
      </p>
    );
  } else {
    body = (
      <table className="cb-table">
        <caption className="sr-only">{dir.heading}</caption>
        <thead>
          <tr>
            <th scope="col">Institution</th>
            <th scope="col">Slug</th>
            <th scope="col">
              <span className="sr-only">Join</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {institutions.slice(0, 6).map((institution) => (
            <tr key={institution.id}>
              <td>
                <span className="cb-table__row">
                  <span className="cb-dir__mark" aria-hidden="true">
                    {(institution.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <strong>{institution.name}</strong>
                </span>
              </td>
              <td className="cb-table__slug">{institution.slug}</td>
              <td className="cb-table__action">
                <Link to="/signup" className="cb-dir__join">
                  {dir.joinLabel}
                  <ChevronRight aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="cb-dir">
      <header className="cb-dir__head">
        <h3>{dir.heading}</h3>
        <p>{dir.intro}</p>
      </header>
      <label className="cb-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search active institutions</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={dir.searchPlaceholder}
          aria-label="Search active institutions"
        />
      </label>
      <div className="cb-dir__body" aria-live="polite">
        {body}
      </div>
      <Link className="cb-link cb-dir__missing" to="/request-institution">
        {dir.missingCta}
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function Foot({ isAuthenticated }) {
  return (
    <footer className="cb-foot">
      <div className="cb-shell cb-foot__inner">
        <Link to="/" className="cb-brand" aria-label={BRAND.homeLabel}>
          <CinnabarMark size="h-7 w-7" withWordmark />
        </Link>
        <nav className="cb-foot__links" aria-label="Footer">
          {FOOTER.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          {!isAuthenticated && <Link to="/login">Sign in</Link>}
        </nav>
        <p className="cb-foot__legal">
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </p>
      </div>
    </footer>
  );
}

export default function CinnabarLanding() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="cinnabar">
      <SystemBar />
      <TopNav isAuthenticated={isAuthenticated} />

      <main>
        <Hero isAuthenticated={isAuthenticated} />
        <TrustStrip />

        <Panel tag="// SECTION: PROBLEM">
          <Head
            eyebrow={PROBLEM.eyebrow}
            title={PROBLEM.heading}
            sub={PROBLEM.intro}
          />
          <ul className="cb-faults">
            {PROBLEM.items.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="cb-fault">
                <span className="cb-fault__code">
                  <span className="cb-led cb-led--warn" aria-hidden="true" />
                  FAULT {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cb-fault__icon">
                  <Icon aria-hidden="true" />
                </span>
                <div className="cb-fault__body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="solution" tag="// SECTION: PLATFORM">
          <Head
            eyebrow={PLATFORM.eyebrow}
            title={PLATFORM.heading}
            sub={PLATFORM.intro}
          />
          <ul className="cb-cmds">
            {PLATFORM.items.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="cb-cmd">
                <span className="cb-cmd__idx">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cb-cmd__caret" aria-hidden="true">
                  {'>'}
                </span>
                <span className="cb-cmd__icon">
                  <Icon aria-hidden="true" />
                </span>
                <div className="cb-cmd__body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="how" tag="// SECTION: PIPELINE">
          <Head eyebrow={HOW.eyebrow} title={HOW.heading} sub={HOW.intro} />
          <ol className="cb-steps">
            {HOW.steps.map(({ num, title, text }) => (
              <li key={num} className="cb-step">
                <div className="cb-step__head">
                  <span className="cb-led cb-led--ok" aria-hidden="true" />
                  <span className="cb-step__num">STEP {num}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel id="security" tag="// SECTION: ISOLATION">
          <div className="cb-iso">
            <div className="cb-iso__copy">
              <Head
                eyebrow={ISOLATION.eyebrow}
                title={ISOLATION.heading}
                sub={ISOLATION.intro}
              />
              <ul className="cb-points">
                {ISOLATION.points.map((point) => (
                  <li key={point}>
                    <Check aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="cb-mon">
              <div className="cb-mon__head">
                <span>isolation monitor</span>
                <span className="cb-mon__live">
                  <span className="cb-led cb-led--live" aria-hidden="true" />
                  live
                </span>
              </div>
              <div className="cb-mon__scroll">
                <table
                  className="cb-table"
                  aria-label="Live tenant isolation monitor"
                >
                  <thead>
                    <tr>
                      <th scope="col">Tenant</th>
                      <th scope="col">Domain</th>
                      <th scope="col">Index</th>
                      <th scope="col">Region</th>
                      <th scope="col">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ISOLATION.tenants.map((tenant) => (
                      <tr key={tenant.name}>
                        <td>
                          <span className="cb-mon__tenant">
                            <span
                              className={`cb-led${
                                tenant.active ? ' cb-led--ok' : ''
                              }`}
                              aria-hidden="true"
                            />
                            {tenant.name}
                            {tenant.meta.slice(2).map((extra) => (
                              <small key={extra}>{extra}</small>
                            ))}
                          </span>
                        </td>
                        <td>{tenant.domain}</td>
                        <td>{tenant.meta[0]}</td>
                        <td>{tenant.meta[1]}</td>
                        <td>
                          <span
                            className={`cb-pill${
                              tenant.active ? ' cb-pill--ok' : ' cb-pill--idle'
                            }`}
                          >
                            {tenant.active ? 'active' : 'idle'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="cb-mon__audit">
                <Lock aria-hidden="true" />
                audit · tenant_id bound per query · every read logged &amp;
                reviewable
              </p>
            </div>
          </div>
        </Panel>

        <Panel id="grounding" tag="// SECTION: GROUNDING">
          <Head
            eyebrow={GROUNDING.eyebrow}
            title={GROUNDING.heading}
            sub={GROUNDING.intro}
          />
          <div className="cb-ground">
            <div className="cb-ground__answer">
              <GroundedChat />
              <ol className="cb-retr" aria-label="Retrieval trace">
                {RETRIEVAL.map(([op, detail]) => (
                  <li key={op} className="cb-retr__step">
                    <Check aria-hidden="true" />
                    <span className="cb-retr__op">{op}</span>
                    <span className="cb-retr__detail">{detail}</span>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="cb-src" aria-label="Retrieved sources">
              <div className="cb-src__head">
                <span>retrieved sources</span>
                <span>{CHAT.sources.length} ranked</span>
              </div>
              <ul className="cb-src__list">
                {CHAT.sources.map(([doc, score, meta]) => (
                  <li key={doc} className="cb-src__item">
                    <span className="cb-src__top">
                      <span className="cb-src__doc">{doc}</span>
                      <span className="cb-src__score">{score}</span>
                    </span>
                    <span className="cb-src__meta">
                      <BadgeCheck aria-hidden="true" />
                      {meta}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Panel>

        <Panel id="roles" tag="// SECTION: ROLES">
          <Head eyebrow={ROLES.eyebrow} title={ROLES.heading} sub={ROLES.intro} />
          <div className="cb-roles">
            {ROLES.items.map(({ icon: Icon, label, title, text }) => (
              <article key={label} className="cb-role">
                <div className="cb-role__bar">
                  <span className="cb-role__ico">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="cb-role__label">{label}</span>
                  <span className="cb-chrome" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="cb-role__body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel tag="// SECTION: SIGNALS">
          <Head
            eyebrow={SIGNALS.eyebrow}
            title={SIGNALS.heading}
            sub={SIGNALS.intro}
          />
          <div className="cb-sigs">
            {SIGNALS.items.map(({ icon: Icon, title, text, bars }) => (
              <article key={title} className="cb-sig">
                <div className="cb-sig__head">
                  <span className="cb-sig__title">
                    <Icon aria-hidden="true" />
                    {title}
                  </span>
                </div>
                <div className="cb-meter" aria-hidden="true">
                  {bars.map((height, i) => (
                    <span
                      key={i}
                      className={`cb-meter__col${
                        height >= 7 ? ' is-hot' : ''
                      }`}
                    >
                      <i className="cb-meter__led" />
                      <i
                        className="cb-meter__bar"
                        style={{ height: `${(height / 10) * 100}%` }}
                      />
                    </span>
                  ))}
                </div>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel tag="// SECTION: COMMITMENTS">
          <Head eyebrow={COMMITMENTS.eyebrow} title={COMMITMENTS.heading} />
          <ul className="cb-commits">
            {COMMITMENTS.items.map(({ num, title, text }) => (
              <li key={num} className="cb-commit">
                <span className="cb-commit__check">
                  <Check aria-hidden="true" />
                </span>
                <span className="cb-commit__num">{num}</span>
                <div className="cb-commit__body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="roadmap" tag="// SECTION: ROADMAP">
          <Head
            eyebrow={ROADMAP.eyebrow}
            title={ROADMAP.heading}
            sub={ROADMAP.intro}
          />
          <div className="cb-road">
            {ROADMAP.items.map(({ icon: Icon, status, tag, title, text }) => (
              <article key={title} className="cb-road__card">
                <div className="cb-road__top">
                  <span className="cb-road__ico">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={`cb-pill cb-pill--${statusTone(status)}`}>
                    <span className="cb-led" aria-hidden="true" />
                    {status}
                  </span>
                </div>
                <span className="cb-road__tag">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="institutions" tag="// SECTION: ONBOARD">
          <div className="cb-get">
            <div className="cb-get__copy">
              <Head
                eyebrow={GET_STARTED.eyebrow}
                title={GET_STARTED.heading}
                sub={GET_STARTED.intro}
              />
              <RequestForm />
            </div>
            <Directory />
          </div>
        </Panel>

        <Panel id="faq" tag="// SECTION: FAQ">
          <Head eyebrow={FAQ.eyebrow} title={FAQ.heading} />
          <div className="cb-faq">
            {FAQ.items.map((item) => (
              <details key={item.q} className="cb-faq__item">
                <summary>
                  <span>{item.q}</span>
                  <ChevronDown className="cb-faq__chev" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </Panel>
      </main>

      <Foot isAuthenticated={isAuthenticated} />
    </div>
  );
}
