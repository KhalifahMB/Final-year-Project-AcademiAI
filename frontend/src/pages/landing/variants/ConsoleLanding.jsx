import './console.css';
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
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';

/* Boot/stream telemetry shown next to the hero chat — the ingestion
   pipeline animated as a log a console operator would recognise. */
const BOOT = [
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
    <div className="cn-status">
      <div className="cn-shell cn-status__inner">
        <span className="cn-status__left">
          <Terminal aria-hidden="true" />
          <span>{BRAND.name.toUpperCase()} / CONSOLE</span>
        </span>
        <span className="cn-status__mid">
          <span className="cn-led cn-led--live" aria-hidden="true" />
          {BRAND.tagline}
        </span>
        <span className="cn-status__right">
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
  const name = BRAND.name;
  return (
    <header className="cn-nav">
      <div className="cn-shell cn-nav__inner">
        <Link to="/" className="cn-brand" aria-label={BRAND.homeLabel}>
          <BrandMark size="h-7 w-7" variant="dark" />
          <span className="cn-brand__word">
            {name.slice(0, -2)}
            <span className="cn-accent">{name.slice(-2)}</span>
          </span>
        </Link>

        <nav className="cn-nav__links" aria-label="Landing sections">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="cn-nav__actions">
          <ThemeToggle className="cn-theme" iconOnly />
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link to={HERO.sessionCta.to}>
                {HERO.sessionCta.label}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                className="cn-nav__signin"
                variant="ghost"
                size="sm"
                asChild
              >
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
    <div className="cn-chat">
      <div className="cn-chat__bar">
        <span className="cn-chat__lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="cn-chat__title">{CHAT.bar}</span>
        <span className="cn-chat__state">
          <span className="cn-led cn-led--ok" aria-hidden="true" />
          {CHAT.status}
        </span>
      </div>

      <div className="cn-chat__body">
        <p className="cn-chat__user">
          <span className="cn-prompt" aria-hidden="true">
            &gt;
          </span>
          {CHAT.question}
        </p>

        <div className="cn-chat__ans">
          <p
            className={`cn-chat__stream${
              stream ? ' cn-chat__stream--run' : ''
            }`}
          >
            {CHAT.answer}
            {stream ? <span className="cn-caret" aria-hidden="true" /> : null}
          </p>

          <span className="cn-chat__cite">
            <BadgeCheck aria-hidden="true" />
            <strong>{CHAT.citation.index}</strong>
            <span>{CHAT.citation.doc}</span>
            <span className="cn-dot" aria-hidden="true">
              ·
            </span>
            <span>{CHAT.citation.page}</span>
            <span className="cn-dot" aria-hidden="true">
              ·
            </span>
            <span>{CHAT.citation.score}</span>
          </span>

          <span className="cn-chat__meta">
            {CHAT.meta.map((item) => (
              <span key={item} className="cn-chip">
                <Check aria-hidden="true" />
                {item}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="cn-chat__foot">
        <span className="cn-prompt" aria-hidden="true">
          &gt;
        </span>
        <span className="cn-chat__ph">{CHAT.placeholder}</span>
        <span className="cn-chat__badge">{CHAT.badge}</span>
      </div>
    </div>
  );
}

function BootLog() {
  return (
    <div className="cn-boot" aria-label="Ingestion pipeline log">
      <div className="cn-boot__head">
        <Activity aria-hidden="true" />
        <span>pipeline</span>
        <span className="cn-boot__state">streaming</span>
      </div>
      <ol className="cn-boot__list">
        {BOOT.map((row) => (
          <li key={row.op} className="cn-boot__row">
            <span className="cn-boot__t">{row.t}</span>
            <span className="cn-boot__op">{row.op}</span>
            <span className="cn-boot__txt">{row.txt}</span>
            <span className="cn-led cn-led--ok" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Hero({ isAuthenticated }) {
  return (
    <section className="cn-hero">
      <div className="cn-shell cn-hero__grid">
        <div className="cn-hero__copy">
          <p className="cn-eyebrow">
            <ShieldCheck aria-hidden="true" />
            {HERO.eyebrow}
          </p>
          <h1 className="cn-hero__title">
            {HERO.headlineLead}
            <em>{HERO.headlineAccent}</em>
            {HERO.headlineTail}
          </h1>
          <p className="cn-lede">{HERO.lede}</p>

          <div className="cn-ctas">
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
                <a className="cn-link" href={HERO.secondaryCta.href}>
                  {HERO.secondaryCta.label}
                  <ChevronRight aria-hidden="true" />
                </a>
              </>
            )}
          </div>

          <ul className="cn-proof">
            {HERO.proof.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="cn-term">
          <div className="cn-term__bar">
            <span className="cn-term__title">academiai — grounded console</span>
            <span className="cn-term__tag">RLS-scoped</span>
          </div>
          <div className="cn-term__body">
            <GroundedChat stream />
            <BootLog />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const count = useLandingStats();
  return (
    <section className="cn-trust" aria-label="Live platform figures">
      <div className="cn-shell cn-trust__inner">
        <span className="cn-trust__label">
          <Activity aria-hidden="true" />
          Trusted across departments
        </span>
        <span className="cn-trust__stats">
          <span className="cn-trust__stat">
            <span className="cn-led cn-led--live" aria-hidden="true" />
            {String(count).padStart(2, '0')} institutions live
          </span>
          <span className="cn-trust__fact">RLS · pgvector/hnsw · audited reads</span>
        </span>
      </div>
    </section>
  );
}

function Panel({ id, tag, children }) {
  return (
    <div className="cn-shell">
      <section id={id} className="cn-panel">
        <header className="cn-panel__bar">
          <span className="cn-panel__tag">{tag}</span>
          <span className="cn-panel__line" aria-hidden="true" />
        </header>
        <div className="cn-panel__body">{children}</div>
      </section>
    </div>
  );
}

function Head({ eyebrow, title, sub }) {
  return (
    <header className="cn-head">
      <p className="cn-eyebrow">{eyebrow}</p>
      <h2 className="cn-h2">{title}</h2>
      {sub ? <p className="cn-sub">{sub}</p> : null}
    </header>
  );
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const form = GET_STARTED.form;

  return (
    <form
      className="cn-form"
      onSubmit={(event) => event.preventDefault()}
      aria-label="Request a workspace"
    >
      <div className="cn-field">
        <label htmlFor="cn-email">{form.emailLabel}</label>
        <input
          id="cn-email"
          type="email"
          autoComplete="email"
          placeholder={form.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="cn-field">
        <label htmlFor="cn-institution">{form.institutionLabel}</label>
        <input
          id="cn-institution"
          type="text"
          autoComplete="organization"
          placeholder={form.institutionPlaceholder}
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
        />
      </div>
      <Button size="lg" className="cn-form__submit" asChild>
        <Link to="/request-institution">
          {form.submitLabel}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <p className="cn-form__note">
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
    body = <p className="cn-dir__note">{dir.loading}</p>;
  } else if (directory.isError) {
    body = <p className="cn-dir__note cn-dir__note--error">{dir.error}</p>;
  } else if (institutions.length === 0) {
    body = (
      <p className="cn-dir__note">
        {search.trim() ? dir.emptySearch : dir.empty}
      </p>
    );
  } else {
    body = (
      <table className="cn-table">
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
                <span className="cn-table__row">
                  <span className="cn-dir__mark" aria-hidden="true">
                    {(institution.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <strong>{institution.name}</strong>
                </span>
              </td>
              <td className="cn-table__slug">{institution.slug}</td>
              <td className="cn-table__action">
                <Link to="/signup" className="cn-dir__join">
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
    <div className="cn-dir">
      <header className="cn-dir__head">
        <h3>{dir.heading}</h3>
        <p>{dir.intro}</p>
      </header>
      <label className="cn-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search active institutions</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={dir.searchPlaceholder}
          aria-label="Search active institutions"
        />
      </label>
      <div className="cn-dir__body" aria-live="polite">
        {body}
      </div>
      <Link className="cn-link cn-dir__missing" to="/request-institution">
        {dir.missingCta}
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function Foot({ isAuthenticated }) {
  const name = BRAND.name;
  return (
    <footer className="cn-foot">
      <div className="cn-shell cn-foot__inner">
        <Link to="/" className="cn-brand" aria-label={BRAND.homeLabel}>
          <BrandMark size="h-6 w-6" variant="dark" />
          <span className="cn-brand__word">
            {name.slice(0, -2)}
            <span className="cn-accent">{name.slice(-2)}</span>
          </span>
        </Link>
        <nav className="cn-foot__links" aria-label="Footer">
          {FOOTER.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          {!isAuthenticated && <Link to="/login">Sign in</Link>}
        </nav>
        <p className="cn-foot__legal">
          © {new Date().getFullYear()} {name} · {BRAND.tagline}
        </p>
      </div>
    </footer>
  );
}

export default function ConsoleLanding() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="console">
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
          <ul className="cn-faults">
            {PROBLEM.items.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="cn-fault">
                <span className="cn-fault__code">
                  FAULT {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cn-fault__icon">
                  <Icon aria-hidden="true" />
                </span>
                <div className="cn-fault__body">
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
          <ul className="cn-cmds">
            {PLATFORM.items.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="cn-cmd">
                <span className="cn-cmd__idx">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="cn-cmd__caret" aria-hidden="true">
                  &gt;
                </span>
                <span className="cn-cmd__icon">
                  <Icon aria-hidden="true" />
                </span>
                <div className="cn-cmd__body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="how" tag="// SECTION: PIPELINE">
          <Head eyebrow={HOW.eyebrow} title={HOW.heading} sub={HOW.intro} />
          <ol className="cn-pipe">
            {HOW.steps.map(({ num, title, text }) => (
              <li key={num} className="cn-pipe__step">
                <div className="cn-pipe__head">
                  <span className="cn-led cn-led--ok" aria-hidden="true" />
                  <span className="cn-pipe__num">STEP {num}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel id="security" tag="// SECTION: ISOLATION">
          <div className="cn-iso">
            <div className="cn-iso__copy">
              <Head
                eyebrow={ISOLATION.eyebrow}
                title={ISOLATION.heading}
                sub={ISOLATION.intro}
              />
              <ul className="cn-points">
                {ISOLATION.points.map((point) => (
                  <li key={point}>
                    <Check aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="cn-mon">
              <div className="cn-mon__head">
                <span>isolation monitor</span>
                <span className="cn-mon__live">
                  <span className="cn-led cn-led--live" aria-hidden="true" />
                  live
                </span>
              </div>
              <div className="cn-mon__scroll">
                <table className="cn-table" aria-label="Live tenant isolation monitor">
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
                          <span className="cn-mon__tenant">
                            <span
                              className={`cn-led${
                                tenant.active ? ' cn-led--ok' : ''
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
                            className={`cn-pill${
                              tenant.active ? ' cn-pill--ok' : ' cn-pill--idle'
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
              <p className="cn-mon__audit">
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
          <div className="cn-ground">
            <div className="cn-ground__answer">
              <GroundedChat />
              <ol className="cn-retr" aria-label="Retrieval trace">
                {RETRIEVAL.map(([op, detail]) => (
                  <li key={op} className="cn-retr__step">
                    <Check aria-hidden="true" />
                    <span className="cn-retr__op">{op}</span>
                    <span className="cn-retr__detail">{detail}</span>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="cn-src" aria-label="Retrieved sources">
              <div className="cn-src__head">
                <span>retrieved sources</span>
                <span>{CHAT.sources.length} ranked</span>
              </div>
              <ul className="cn-src__list">
                {CHAT.sources.map(([doc, score, meta]) => (
                  <li key={doc} className="cn-src__item">
                    <span className="cn-src__top">
                      <span className="cn-src__doc">{doc}</span>
                      <span className="cn-src__score">{score}</span>
                    </span>
                    <span className="cn-src__meta">
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
          <div className="cn-roles">
            {ROLES.items.map(({ icon: Icon, label, title, text }) => (
              <article key={label} className="cn-role">
                <div className="cn-role__bar">
                  <span className="cn-role__ico">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="cn-role__label">{label}</span>
                  <span className="cn-chat__lights" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="cn-role__body">
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
          <div className="cn-sigs">
            {SIGNALS.items.map(({ icon: Icon, title, text, bars }) => (
              <article key={title} className="cn-sig">
                <div className="cn-sig__head">
                  <span className="cn-sig__title">
                    <Icon aria-hidden="true" />
                    {title}
                  </span>
                </div>
                <div className="cn-meter" aria-hidden="true">
                  {bars.map((height, i) => (
                    <span
                      key={i}
                      className={`cn-meter__col${
                        height >= 7 ? ' is-hot' : ''
                      }`}
                    >
                      <i className="cn-meter__led" />
                      <i
                        className="cn-meter__bar"
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
          <Head
            eyebrow={COMMITMENTS.eyebrow}
            title={COMMITMENTS.heading}
          />
          <ul className="cn-commits">
            {COMMITMENTS.items.map(({ num, title, text }) => (
              <li key={num} className="cn-commit">
                <span className="cn-commit__check">
                  <Check aria-hidden="true" />
                </span>
                <span className="cn-commit__num">{num}</span>
                <div className="cn-commit__body">
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
          <div className="cn-road">
            {ROADMAP.items.map(({ icon: Icon, status, tag, title, text }) => (
              <article key={title} className="cn-road__card">
                <div className="cn-road__top">
                  <span className="cn-road__ico">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={`cn-pill cn-pill--${statusTone(status)}`}>
                    <span className="cn-led" aria-hidden="true" />
                    {status}
                  </span>
                </div>
                <span className="cn-road__tag">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="institutions" tag="// SECTION: ONBOARD">
          <div className="cn-get">
            <div className="cn-get__copy">
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
          <div className="cn-faq">
            {FAQ.items.map((item) => (
              <details key={item.q} className="cn-faq__item">
                <summary>
                  <span>{item.q}</span>
                  <ChevronDown className="cn-faq__chev" aria-hidden="true" />
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
