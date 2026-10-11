import './ledger.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useLandingStats, useInstitutionDirectory } from '../hooks';
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

function LedgerHead({ index, eyebrow, title, sub }) {
  return (
    <header className="ledger-head">
      <div className="ledger-rule">
        <span className="ledger-rule__no">{index}</span>
        <span className="ledger-rule__line" aria-hidden="true" />
        <span className="ledger-rule__tag">{eyebrow}</span>
      </div>
      <h2>{title}</h2>
      {sub ? <p className="ledger-head__sub">{sub}</p> : null}
    </header>
  );
}

function GroundedAnswer({ label }) {
  return (
    <figure className="ledger-artifact">
      <div className="ledger-artifact__panel">
        <div className="ledger-artifact__bar">
          <span className="ledger-artifact__name">{CHAT.bar}</span>
          <span className="ledger-artifact__status">
            <i aria-hidden="true" />
            {CHAT.status}
          </span>
        </div>
        <div className="ledger-artifact__body">
          <div className="ledger-qa ledger-qa--q">
            <span className="ledger-qa__tag" aria-hidden="true">
              QUERY
            </span>
            <p>{CHAT.question}</p>
          </div>
          <div className="ledger-qa ledger-qa--a">
            <span className="ledger-qa__tag" aria-hidden="true">
              <BadgeCheck aria-hidden="true" />
              {CHAT.badge}
            </span>
            <p>{CHAT.answer}</p>
            <div className="ledger-cite">
              <strong>{CHAT.citation.index}</strong>
              <span>{CHAT.citation.doc}</span>
              <span className="ledger-cite__sep" aria-hidden="true">
                ·
              </span>
              <span>{CHAT.citation.page}</span>
              <span className="ledger-cite__sep" aria-hidden="true">
                ·
              </span>
              <span>{CHAT.citation.score}</span>
            </div>
          </div>
          <ul className="ledger-trace" aria-label="Retrieval trace">
            {CHAT.meta.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="ledger-artifact__input" aria-hidden="true">
          <Search aria-hidden="true" />
          <span>{CHAT.placeholder}</span>
        </div>
      </div>
      <figcaption className="ledger-artifact__cap">
        <span className="ledger-artifact__cap-no">{label}</span>
        <span>Every claim carries its document, page and score.</span>
      </figcaption>
    </figure>
  );
}

function IsolationFigure() {
  return (
    <figure className="ledger-fig">
      <div className="ledger-fig__frame">
        <svg
          viewBox="0 0 640 340"
          className="ledger-fig__svg"
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="ledger-svg-frame" x="16" y="40" width="608" height="256" rx="12" />
          <text className="ledger-svg-title" x="32" y="64">
            ACADEMIAI CLUSTER · ROW-LEVEL SECURITY
          </text>

          <rect className="ledger-svg-box" x="44" y="82" width="248" height="180" rx="8" />
          <rect className="ledger-svg-box" x="348" y="82" width="248" height="180" rx="8" />

          <text className="ledger-svg-label" x="62" y="106">
            TENANT_A
          </text>
          <text className="ledger-svg-meta" x="62" y="122">
            uniben.edu.ng
          </text>
          <text className="ledger-svg-label" x="366" y="106">
            TENANT_B
          </text>
          <text className="ledger-svg-meta" x="366" y="122">
            parakou.bj
          </text>

          <line className="ledger-svg-row" x1="62" y1="150" x2="274" y2="150" />
          <line className="ledger-svg-row" x1="62" y1="176" x2="274" y2="176" />
          <line className="ledger-svg-row" x1="62" y1="202" x2="274" y2="202" />
          <line className="ledger-svg-row" x1="366" y1="150" x2="578" y2="150" />
          <line className="ledger-svg-row" x1="366" y1="176" x2="578" y2="176" />
          <line className="ledger-svg-row" x1="366" y1="202" x2="578" y2="202" />

          <circle className="ledger-svg-node" cx="62" cy="150" r="3" />
          <circle className="ledger-svg-node" cx="62" cy="176" r="3" />
          <circle className="ledger-svg-node" cx="366" cy="150" r="3" />

          <text className="ledger-svg-meta" x="62" y="244">
            region eu-west-1
          </text>
          <text className="ledger-svg-meta" x="366" y="244">
            region eu-west-1
          </text>

          <line className="ledger-svg-rls" x1="320" y1="62" x2="320" y2="280" />

          <circle className="ledger-svg-lock" cx="320" cy="171" r="16" />
          <path
            className="ledger-svg-lockmark"
            d="M315.5 171 v-4 a4.5 4.5 0 0 1 9 0 v4"
          />
          <rect className="ledger-svg-lockmark" x="313" y="171" width="14" height="11" rx="2" />

          <g className="ledger-svg-mark">
            <circle cx="320" cy="126" r="9" />
            <text x="320" y="130">1</text>
          </g>
          <g className="ledger-svg-mark">
            <circle cx="200" cy="176" r="9" />
            <text x="200" y="180">2</text>
          </g>
          <g className="ledger-svg-mark">
            <circle cx="96" cy="278" r="9" />
            <text x="96" y="282">3</text>
          </g>
          <g className="ledger-svg-mark">
            <circle cx="544" cy="278" r="9" />
            <text x="544" y="282">4</text>
          </g>
        </svg>
      </div>
      <figcaption className="ledger-fig__cap">
        Fig. 04 — Isolation is enforced in the database, not promised in a policy page.
      </figcaption>
      <ol className="ledger-fig__notes">
        {ISOLATION.points.map((point, i) => (
          <li key={point}>
            <span className="ledger-fig__note-no" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            {point}
          </li>
        ))}
      </ol>
      <ul className="ledger-chips" aria-label="Tenant examples">
        {ISOLATION.tenants.map((tenant) => (
          <li
            className={`ledger-chip${tenant.active ? '' : ' ledger-chip--idle'}`}
            key={tenant.name}
          >
            <span className="ledger-chip__name">{tenant.name}</span>
            <span className="ledger-chip__domain">{tenant.domain}</span>
            <span className="ledger-chip__tag">
              <Lock aria-hidden="true" />
              {tenant.tag}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function SourcesRail() {
  return (
    <aside className="ledger-sources" aria-label="Retrieved sources">
      <div className="ledger-sources__head">
        <span>RETRIEVED SOURCES</span>
        <span className="ledger-sources__count">{CHAT.sources.length} ranked</span>
      </div>
      <ul className="ledger-sources__list">
        {CHAT.sources.map(([doc, score, meta]) => (
          <li className="ledger-source" key={doc}>
            <div className="ledger-source__top">
              <span className="ledger-source__doc">{doc}</span>
              <span className="ledger-source__score">{score}</span>
            </div>
            <span className="ledger-source__meta">
              <BadgeCheck aria-hidden="true" />
              {meta}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');

  return (
    <form
      className="ledger-form"
      aria-label="Request a workspace"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="ledger-field">
        <label htmlFor="ledger-email">{GET_STARTED.form.emailLabel}</label>
        <input
          id="ledger-email"
          type="email"
          autoComplete="email"
          placeholder={GET_STARTED.form.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="ledger-field">
        <label htmlFor="ledger-institution">{GET_STARTED.form.institutionLabel}</label>
        <input
          id="ledger-institution"
          type="text"
          autoComplete="organization"
          placeholder={GET_STARTED.form.institutionPlaceholder}
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
        />
      </div>
      <Button size="lg" className="ledger-form__submit" asChild>
        <Link to="/request-institution">
          {GET_STARTED.form.submitLabel}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <p className="ledger-form__note">
        <Lock aria-hidden="true" />
        {GET_STARTED.form.note}
      </p>
    </form>
  );
}

function Directory() {
  const [search, setSearch] = useState('');
  const query = search.trim();
  const { data, isLoading, isError } = useInstitutionDirectory(query);
  const institutions = data || [];

  return (
    <div className="ledger-dir">
      <h3 className="ledger-dir__title">{GET_STARTED.directory.heading}</h3>
      <p className="ledger-dir__intro">{GET_STARTED.directory.intro}</p>
      <label className="ledger-search">
        <Search aria-hidden="true" />
        <span className="ledger-search__label">Search active institutions</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={GET_STARTED.directory.searchPlaceholder}
        />
      </label>
      <div className="ledger-dir__list" aria-live="polite">
        {isLoading ? (
          <p className="ledger-note">{GET_STARTED.directory.loading}</p>
        ) : isError ? (
          <p className="ledger-note ledger-note--error">{GET_STARTED.directory.error}</p>
        ) : institutions.length === 0 ? (
          <p className="ledger-note">
            {query ? GET_STARTED.directory.emptySearch : GET_STARTED.directory.empty}
          </p>
        ) : (
          institutions.slice(0, 6).map((institution) => (
            <Link key={institution.id} to="/signup" className="ledger-inst">
              <span className="ledger-inst__mark" aria-hidden="true">
                {(institution.name || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="ledger-inst__meta">
                <strong>{institution.name}</strong>
                <small>{institution.slug}</small>
              </span>
              <span className="ledger-inst__join">{GET_STARTED.directory.joinLabel}</span>
            </Link>
          ))
        )}
      </div>
      <Link className="ledger-textlink" to="/request-institution">
        {GET_STARTED.directory.missingCta}
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function LedgerLanding() {
  const { isAuthenticated } = useAuth();
  const institutionCount = useLandingStats();
  const year = new Date().getFullYear();

  return (
    <div className="ledger">
      <header className="ledger-nav">
        <div className="ledger-wrap ledger-nav__inner">
          <Link to="/" className="ledger-brand" aria-label={BRAND.homeLabel}>
            <BrandMark size="h-8 w-8" />
            <span className="ledger-brand__word">
              Academi<em>AI</em>
            </span>
          </Link>
          <nav className="ledger-nav__links" aria-label="Landing sections">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ledger-nav__actions">
            <ThemeToggle className="ledger-theme" iconOnly />
            {isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">
                  Open workspace
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="ledger-auth-ghost" asChild>
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

      <main>
        <section className="ledger-hero" aria-labelledby="ledger-hero-title">
          <div className="ledger-wrap ledger-hero__grid">
            <div className="ledger-hero__lead">
              <p className="ledger-eyebrow">
                <ShieldCheck aria-hidden="true" />
                {HERO.eyebrow}
              </p>
              <h1 id="ledger-hero-title" className="ledger-hero__title">
                {HERO.headlineLead}
                <em>{HERO.headlineAccent}</em>
                {HERO.headlineTail}
              </h1>
              <p className="ledger-lede">{HERO.lede}</p>
              <div className="ledger-actions">
                {isAuthenticated ? (
                  <Button size="lg" asChild>
                    <Link to="/dashboard">
                      Open workspace
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
                    <a className="ledger-textlink" href={HERO.secondaryCta.href}>
                      {HERO.secondaryCta.label}
                      <ArrowRight aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
              <ul className="ledger-proof">
                {HERO.proof.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <GroundedAnswer label="FIG. 01" />
          </div>
        </section>

        <section className="ledger-trust" aria-label="Live platform figures">
          <div className="ledger-wrap ledger-trust__inner">
            <span className="ledger-trust__label">TRUSTED ACROSS DEPARTMENTS</span>
            <span className="ledger-trust__line" aria-hidden="true" />
            <span className="ledger-trust__count">
              <i aria-hidden="true" />
              {institutionCount} institutions live
            </span>
            <span className="ledger-trust__meta">RLS · pgvector · audited reads</span>
          </div>
        </section>

        <section className="ledger-section ledger-problem" aria-labelledby="ledger-problem-title">
          <div className="ledger-wrap ledger-problem__grid">
            <LedgerHead
              index="01"
              eyebrow={PROBLEM.eyebrow}
              title={PROBLEM.heading}
              sub={PROBLEM.intro}
            />
            <ol className="ledger-faults">
              {PROBLEM.items.map(({ icon: Icon, title, text }, i) => (
                <li className="ledger-fault" key={title}>
                  <span className="ledger-fault__no" aria-hidden="true">
                    {`F-${String(i + 1).padStart(2, '0')}`}
                  </span>
                  <span className="ledger-fault__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="ledger-fault__body">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={PLATFORM.id} className="ledger-section ledger-platform">
          <div className="ledger-wrap">
            <LedgerHead index="02" eyebrow={PLATFORM.eyebrow} title={PLATFORM.heading} sub={PLATFORM.intro} />
            <ol className="ledger-list">
              {PLATFORM.items.map(({ icon: Icon, title, text }, i) => (
                <li className="ledger-entry" key={title}>
                  <span className="ledger-entry__no" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="ledger-entry__main">
                    <span className="ledger-entry__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div className="ledger-entry__body">
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={HOW.id} className="ledger-section ledger-how">
          <div className="ledger-wrap">
            <LedgerHead index="03" eyebrow={HOW.eyebrow} title={HOW.heading} sub={HOW.intro} />
            <ol className="ledger-steps">
              {HOW.steps.map(({ num, title, text }) => (
                <li className="ledger-step" key={num}>
                  <span className="ledger-step__node" aria-hidden="true">
                    <i />
                  </span>
                  <span className="ledger-step__num">{num}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={ISOLATION.id} className="ledger-section ledger-isolation">
          <div className="ledger-wrap ledger-isolation__grid">
            <div className="ledger-isolation__copy">
              <LedgerHead index="04" eyebrow={ISOLATION.eyebrow} title={ISOLATION.heading} sub={ISOLATION.intro} />
            </div>
            <IsolationFigure />
          </div>
        </section>

        <section id={GROUNDING.id} className="ledger-section ledger-grounding">
          <div className="ledger-wrap">
            <LedgerHead index="05" eyebrow={GROUNDING.eyebrow} title={GROUNDING.heading} sub={GROUNDING.intro} />
            <div className="ledger-grounding__grid">
              <GroundedAnswer label="FIG. 05" />
              <SourcesRail />
            </div>
          </div>
        </section>

        <section id={ROLES.id} className="ledger-section ledger-roles">
          <div className="ledger-wrap">
            <LedgerHead index="06" eyebrow={ROLES.eyebrow} title={ROLES.heading} sub={ROLES.intro} />
            <div className="ledger-cards ledger-cards--roles">
              {ROLES.items.map(({ icon: Icon, label, title, text }, i) => (
                <article className="ledger-card ledger-role" key={label}>
                  <div className="ledger-role__top">
                    <span className="ledger-role__no" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="ledger-role__icon" aria-hidden="true">
                      <Icon />
                    </span>
                  </div>
                  <span className="ledger-role__label">{label}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ledger-section ledger-signals">
          <div className="ledger-wrap">
            <LedgerHead index="07" eyebrow={SIGNALS.eyebrow} title={SIGNALS.heading} sub={SIGNALS.intro} />
            <div className="ledger-meters">
              {SIGNALS.items.map(({ icon: Icon, title, text, bars }) => (
                <article className="ledger-meter" key={title}>
                  <div className="ledger-meter__head">
                    <span className="ledger-meter__title">{title}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <p>{text}</p>
                  <div className="ledger-meter__bars" aria-hidden="true">
                    {bars.map((height, i) => (
                      <i
                        key={i}
                        className={height >= 7 ? 'is-hot' : undefined}
                        style={{ height: `${(height / 10) * 100}%` }}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ledger-section ledger-commitments">
          <div className="ledger-wrap">
            <LedgerHead index="08" eyebrow={COMMITMENTS.eyebrow} title={COMMITMENTS.heading} />
            <ol className="ledger-commitments__list">
              {COMMITMENTS.items.map(({ num, title, text }) => (
                <li className="ledger-commitment" key={num}>
                  <span className="ledger-commitment__no" aria-hidden="true">
                    {num}
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={ROADMAP.id} className="ledger-section ledger-roadmap">
          <div className="ledger-wrap">
            <LedgerHead index="09" eyebrow={ROADMAP.eyebrow} title={ROADMAP.heading} sub={ROADMAP.intro} />
            <div className="ledger-cards ledger-cards--roadmap">
              {ROADMAP.items.map(({ icon: Icon, status, tag, title, text }) => (
                <article className="ledger-card ledger-road" key={title}>
                  <div className="ledger-road__top">
                    <span className="ledger-road__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="ledger-road__status">{status}</span>
                  </div>
                  <span className="ledger-road__tag">{tag}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id={GET_STARTED.id} className="ledger-section ledger-get">
          <div className="ledger-wrap ledger-get__grid">
            <div className="ledger-get__intro">
              <LedgerHead index="10" eyebrow={GET_STARTED.eyebrow} title={GET_STARTED.heading} sub={GET_STARTED.intro} />
              <RequestForm />
            </div>
            <Directory />
          </div>
        </section>

        <section id={FAQ.id} className="ledger-section ledger-faq">
          <div className="ledger-wrap">
            <LedgerHead index="11" eyebrow={FAQ.eyebrow} title={FAQ.heading} />
            <div className="ledger-faq__list">
              {FAQ.items.map((item) => (
                <details className="ledger-faq__item" key={item.q}>
                  <summary>
                    <span>{item.q}</span>
                    <ChevronDown className="ledger-faq__chevron" aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="ledger-foot">
        <div className="ledger-wrap ledger-foot__inner">
          <Link to="/" className="ledger-brand" aria-label={BRAND.homeLabel}>
            <BrandMark size="h-7 w-7" />
            <span className="ledger-brand__word">
              Academi<em>AI</em>
            </span>
          </Link>
          <nav className="ledger-foot__links" aria-label="Footer">
            {FOOTER.links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            {!isAuthenticated && <Link to="/login">Sign in</Link>}
          </nav>
          <span className="ledger-foot__note">
            © {year} {BRAND.name} · {BRAND.tagline}
          </span>
        </div>
      </footer>
    </div>
  );
}
