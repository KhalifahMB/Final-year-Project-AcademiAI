import './atlas.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, ChevronDown, Lock, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import BrandMark from '@/components/shared/BrandMark';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function SectionOpener({ numeral, children }) {
  return (
    <p className="atlas-opener">
      <span className="atlas-opener__num" aria-hidden="true">
        &sect; {numeral}
      </span>
      <span className="atlas-opener__rule" aria-hidden="true" />
      <span className="atlas-opener__label">{children}</span>
    </p>
  );
}

function CompassMotif() {
  return (
    <svg
      className="atlas-compass"
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="atlas-compass__ring" cx="100" cy="100" r="92" />
      <circle
        className="atlas-compass__ring atlas-compass__ring--dash"
        cx="100"
        cy="100"
        r="70"
      />
      <g className="atlas-compass__ticks">
        <line x1="100" y1="8" x2="100" y2="26" />
        <line x1="100" y1="174" x2="100" y2="192" />
        <line x1="8" y1="100" x2="26" y2="100" />
        <line x1="174" y1="100" x2="192" y2="100" />
      </g>
      <path
        className="atlas-compass__needle"
        d="M100 26 L112 100 L100 174 L88 100 Z"
      />
      <path
        className="atlas-compass__needle-alt"
        d="M26 100 L100 88 L174 100 L100 112 Z"
      />
      <circle className="atlas-compass__hub" cx="100" cy="100" r="5" />
    </svg>
  );
}

function ChatSpecimen({ field = false }) {
  return (
    <figure
      className={`atlas-specimen${field ? ' atlas-specimen--field' : ''}`}
    >
      <figcaption className="atlas-specimen__bar">
        <span className="atlas-specimen__badge">{CHAT.badge}</span>
        <span className="atlas-specimen__title">{CHAT.bar}</span>
        <span className="atlas-specimen__status">
          <i aria-hidden="true" />
          {CHAT.status}
        </span>
      </figcaption>
      <div className="atlas-specimen__body">
        <p className="atlas-msg atlas-msg--ask">
          <span aria-hidden="true">&gt;</span> {CHAT.question}
        </p>
        <div className="atlas-msg atlas-msg--answer">
          <p>{CHAT.answer}</p>
          <div className="atlas-cite">
            <BadgeCheck aria-hidden="true" />
            <strong>{CHAT.citation.index}</strong>
            <span>
              {CHAT.citation.doc} &middot; {CHAT.citation.page} &middot;{' '}
              {CHAT.citation.score}
            </span>
          </div>
          <ul className="atlas-meta">
            {CHAT.meta.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="atlas-specimen__foot">
        <Search aria-hidden="true" />
        <span>{CHAT.placeholder}</span>
      </div>
    </figure>
  );
}

function RegionMap() {
  return (
    <div className="atlas-map" aria-label="Map of isolated tenants">
      <div className="atlas-map__plot">
        <svg
          className="atlas-map__contours"
          viewBox="0 0 320 220"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M18 34 H302 V186 H18 Z" />
          <path d="M52 60 H268 V160 H52 Z" />
          <path d="M92 88 H228 V132 H92 Z" />
          <line x1="18" y1="110" x2="302" y2="110" />
          <line x1="160" y1="34" x2="160" y2="186" />
          <circle cx="52" cy="60" r="2.5" />
          <circle cx="268" cy="60" r="2.5" />
          <circle cx="52" cy="160" r="2.5" />
          <circle cx="268" cy="160" r="2.5" />
        </svg>
        <span className="atlas-map__sheet" aria-hidden="true">
          Sheet 03 &middot; Tenants
        </span>
        <ul className="atlas-map__regions">
          {ISOLATION.tenants.map((tenant) => (
            <li
              key={tenant.name}
              className={`atlas-region${tenant.active ? ' is-active' : ''}`}
            >
              <span className="atlas-region__mark" aria-hidden="true" />
              <span className="atlas-region__name">{tenant.name}</span>
              <span className="atlas-region__tag">
                <Lock aria-hidden="true" />
                {tenant.tag}
              </span>
              <span className="atlas-region__domain">{tenant.domain}</span>
              <span className="atlas-region__meta">{tenant.meta.join(' · ')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GetStartedPanel() {
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const query = search.trim();
  const directory = useInstitutionDirectory(query);
  const institutions = directory.data || [];

  return (
    <div className="atlas-request__panel">
      <div className="atlas-request__copy">
        <SectionOpener numeral={ROMAN[9]}>{GET_STARTED.eyebrow}</SectionOpener>
        <h2 className="atlas-h2">{GET_STARTED.heading}</h2>
        <p className="atlas-intro">{GET_STARTED.intro}</p>
        <form
          className="atlas-form"
          onSubmit={(event) => event.preventDefault()}
          aria-label="Request a workspace"
        >
          <div className="atlas-field">
            <label htmlFor="atlas-email">{GET_STARTED.form.emailLabel}</label>
            <input
              id="atlas-email"
              type="email"
              autoComplete="email"
              placeholder={GET_STARTED.form.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="atlas-field">
            <label htmlFor="atlas-institution">
              {GET_STARTED.form.institutionLabel}
            </label>
            <input
              id="atlas-institution"
              type="text"
              autoComplete="organization"
              placeholder={GET_STARTED.form.institutionPlaceholder}
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
            />
          </div>
          <Button size="lg" className="atlas-form__submit" asChild>
            <Link to="/request-institution">
              {GET_STARTED.form.submitLabel}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <p className="atlas-form__note">
            <Lock aria-hidden="true" />
            <span>{GET_STARTED.form.note}</span>
          </p>
        </form>
      </div>

      <aside className="atlas-directory">
        <h3 className="atlas-directory__head">
          {GET_STARTED.directory.heading}
        </h3>
        <p className="atlas-directory__intro">
          {GET_STARTED.directory.intro}
        </p>
        <label className="atlas-search">
          <Search aria-hidden="true" />
          <span className="atlas-sr">Search active institutions</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={GET_STARTED.directory.searchPlaceholder}
            aria-label="Search active institutions"
          />
        </label>
        <div className="atlas-directory__list" aria-live="polite">
          {directory.isLoading ? (
            <p className="atlas-directory__note">
              {GET_STARTED.directory.loading}
            </p>
          ) : directory.isError ? (
            <p className="atlas-directory__note atlas-directory__note--error">
              {GET_STARTED.directory.error}
            </p>
          ) : institutions.length === 0 ? (
            <p className="atlas-directory__note">
              {query
                ? GET_STARTED.directory.emptySearch
                : GET_STARTED.directory.empty}
            </p>
          ) : (
            institutions.slice(0, 6).map((entry) => (
              <Link
                key={entry.id}
                to="/signup"
                className="atlas-inst"
              >
                <span className="atlas-inst__mark" aria-hidden="true">
                  {(entry.name || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="atlas-inst__body">
                  <strong>{entry.name}</strong>
                  <small>{entry.slug}</small>
                </span>
                <span className="atlas-inst__join">
                  {GET_STARTED.directory.joinLabel}
                </span>
              </Link>
            ))
          )}
        </div>
        <Link className="atlas-directory__cta" to="/request-institution">
          {GET_STARTED.directory.missingCta}
          <ArrowRight aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}

export default function AtlasLanding() {
  const { isAuthenticated } = useAuth();
  const institutionCount = useLandingStats();

  return (
    <div className="atlas">
      <header className="atlas-masthead">
        <div className="atlas-shell atlas-masthead__bar">
          <Link to="/" className="atlas-brand" aria-label={BRAND.homeLabel}>
            <BrandMark size="h-9 w-9" />
            <span className="atlas-brand__word">
              Academi<em>AI</em>
            </span>
            <span className="atlas-brand__colophon" aria-hidden="true">
              Est. MMXXV
            </span>
          </Link>
          <div className="atlas-masthead__actions">
            <ThemeToggle iconOnly className="atlas-theme" />
            {isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">
                  {HERO.sessionCta.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Link className="atlas-signin" to="/login">
                  Sign in
                </Link>
                <Button size="sm" asChild>
                  <Link to="/request-institution">
                    Request workspace
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <nav
          className="atlas-shell atlas-nav"
          aria-label="Landing page sections"
        >
          <ol className="atlas-nav__list">
            {NAV_LINKS.map((link, index) => (
              <li key={link.href}>
                <a href={link.href}>
                  <span className="atlas-nav__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {link.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main>
        <section className="atlas-hero" aria-label="Introduction">
          <div className="atlas-shell atlas-hero__grid">
            <div className="atlas-hero__kicker">
              <span className="atlas-hero__eyebrow">{HERO.eyebrow}</span>
              <span className="atlas-hero__dateline" aria-hidden="true">
                Field Guide &middot; Volume I
              </span>
            </div>
            <h1 className="atlas-hero__headline">
              {HERO.headlineLead}
              <em>{HERO.headlineAccent}</em>
              {HERO.headlineTail}
            </h1>
            <div className="atlas-hero__body">
              <div className="atlas-hero__lede">
                <p className="atlas-hero__lede-text">{HERO.lede}</p>
                <div className="atlas-hero__ctas">
                  {isAuthenticated ? (
                    <Button size="lg" asChild>
                      <Link to="/dashboard">
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
                      <a
                        className="atlas-textlink"
                        href={HERO.secondaryCta.href}
                      >
                        {HERO.secondaryCta.label}
                        <ArrowRight aria-hidden="true" />
                      </a>
                    </>
                  )}
                </div>
                <ul className="atlas-hero__proof">
                  {HERO.proof.map(({ icon: Icon, label }) => (
                    <li key={label}>
                      <Icon aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="atlas-hero__specimen">
                <CompassMotif />
                <ChatSpecimen />
              </div>
            </div>
          </div>
        </section>

        <section className="atlas-trust" aria-label="Institutions in the atlas">
          <div className="atlas-shell atlas-trust__inner">
            <span className="atlas-trust__label">Institutions in the atlas</span>
            <span className="atlas-trust__figure">
              <strong>{institutionCount}</strong>
              <span>live tenants</span>
            </span>
            <span className="atlas-trust__note">
              Every name below runs in its own isolated, audited tenant.
            </span>
          </div>
        </section>

        <section className="atlas-section atlas-problem">
          <div className="atlas-shell atlas-problem__grid">
            <div className="atlas-problem__head">
              <SectionOpener numeral={ROMAN[0]}>{PROBLEM.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{PROBLEM.heading}</h2>
              <p className="atlas-intro">{PROBLEM.intro}</p>
            </div>
            <ol className="atlas-faults">
              {PROBLEM.items.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="atlas-fault">
                  <span className="atlas-fault__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="atlas-fault__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <div className="atlas-fault__body">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="solution" className="atlas-section atlas-platform">
          <div className="atlas-shell">
            <div className="atlas-platform__head">
              <SectionOpener numeral={ROMAN[1]}>{PLATFORM.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{PLATFORM.heading}</h2>
              <p className="atlas-intro">{PLATFORM.intro}</p>
            </div>
            <div className="atlas-bento">
              {PLATFORM.items.map(({ icon: Icon, title, text }, index) => (
                <article
                  key={title}
                  className={`atlas-bento__tile atlas-bento__tile--${index + 1}`}
                >
                  <span className="atlas-bento__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Icon className="atlas-bento__icon" aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="atlas-section atlas-how">
          <div className="atlas-shell">
            <div className="atlas-how__head">
              <SectionOpener numeral={ROMAN[2]}>{HOW.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{HOW.heading}</h2>
              <p className="atlas-intro">{HOW.intro}</p>
            </div>
            <ol className="atlas-steps">
              {HOW.steps.map((step) => (
                <li key={step.num} className="atlas-step">
                  <span className="atlas-step__tick" aria-hidden="true" />
                  <span className="atlas-step__num">{step.num}</span>
                  <div className="atlas-step__body">
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="security" className="atlas-section atlas-isolation">
          <div className="atlas-shell atlas-isolation__grid">
            <div className="atlas-isolation__copy">
              <SectionOpener numeral={ROMAN[3]}>
                {ISOLATION.eyebrow}
              </SectionOpener>
              <h2 className="atlas-h2">{ISOLATION.heading}</h2>
              <p className="atlas-intro">{ISOLATION.intro}</p>
              <ul className="atlas-checks">
                {ISOLATION.points.map((point) => (
                  <li key={point}>
                    <Check aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <RegionMap />
          </div>
        </section>

        <section id="grounding" className="atlas-section atlas-grounding">
          <div className="atlas-shell">
            <div className="atlas-grounding__head">
              <SectionOpener numeral={ROMAN[4]}>
                {GROUNDING.eyebrow}
              </SectionOpener>
              <h2 className="atlas-h2">{GROUNDING.heading}</h2>
              <p className="atlas-intro">{GROUNDING.intro}</p>
            </div>
            <div className="atlas-notes">
              <div className="atlas-notes__figure">
                <ChatSpecimen field />
              </div>
              <aside className="atlas-margin" aria-label="Retrieved sources">
                <p className="atlas-margin__head">
                  Field notes &mdash; retrieved sources
                </p>
                <ol className="atlas-sources">
                  {CHAT.sources.map(([doc, score, note], index) => (
                    <li key={doc} className="atlas-source">
                      <span className="atlas-source__idx" aria-hidden="true">
                        [{index + 1}]
                      </span>
                      <span className="atlas-source__doc">{doc}</span>
                      <span className="atlas-source__score">{score}</span>
                      <span className="atlas-source__note">{note}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>
        </section>

        <section id="roles" className="atlas-section atlas-roles">
          <div className="atlas-shell">
            <div className="atlas-roles__head">
              <SectionOpener numeral={ROMAN[5]}>{ROLES.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{ROLES.heading}</h2>
              <p className="atlas-intro">{ROLES.intro}</p>
            </div>
            <div className="atlas-roles__grid">
              {ROLES.items.map(({ icon: Icon, label, title, text }, index) => (
                <article key={label} className="atlas-role">
                  <span className="atlas-role__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="atlas-role__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <p className="atlas-role__label">{label}</p>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="atlas-section atlas-signals">
          <div className="atlas-shell">
            <div className="atlas-signals__head">
              <SectionOpener numeral={ROMAN[6]}>{SIGNALS.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{SIGNALS.heading}</h2>
              <p className="atlas-intro">{SIGNALS.intro}</p>
            </div>
            <div className="atlas-signals__grid">
              {SIGNALS.items.map(({ icon: Icon, title, text, bars }) => (
                <article key={title} className="atlas-signal">
                  <div className="atlas-signal__top">
                    <Icon aria-hidden="true" />
                    <h3>{title}</h3>
                  </div>
                  <p>{text}</p>
                  <div className="atlas-signal__plot" aria-hidden="true">
                    {bars.map((height, index) => (
                      <span
                        key={index}
                        className="atlas-signal__bar"
                        data-hot={height >= 7 ? 'true' : undefined}
                        style={{ height: `${(height / 10) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="atlas-signal__axis" aria-hidden="true">
                    <span>low</span>
                    <span>high</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="atlas-section atlas-commitments">
          <div className="atlas-shell">
            <div className="atlas-commitments__head">
              <SectionOpener numeral={ROMAN[7]}>
                {COMMITMENTS.eyebrow}
              </SectionOpener>
              <h2 className="atlas-h2">{COMMITMENTS.heading}</h2>
            </div>
            <div className="atlas-manifesto">
              {COMMITMENTS.items.map(({ num, title, text }) => (
                <article key={num} className="atlas-manifesto__item">
                  <span className="atlas-manifesto__num" aria-hidden="true">
                    {num}
                  </span>
                  <div className="atlas-manifesto__body">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="roadmap" className="atlas-section atlas-roadmap">
          <div className="atlas-shell">
            <div className="atlas-roadmap__head">
              <SectionOpener numeral={ROMAN[8]}>{ROADMAP.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{ROADMAP.heading}</h2>
              <p className="atlas-intro">{ROADMAP.intro}</p>
            </div>
            <div className="atlas-roadmap__grid">
              {ROADMAP.items.map(({ icon: Icon, status, tag, title, text }) => (
                <article
                  key={title}
                  className="atlas-card"
                  data-status={status.toLowerCase().replace(/\s+/g, '-')}
                >
                  <div className="atlas-card__top">
                    <span className="atlas-card__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="atlas-pill">{status}</span>
                  </div>
                  <p className="atlas-card__tag">{tag}</p>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="institutions" className="atlas-section atlas-request">
          <div className="atlas-shell">
            <GetStartedPanel />
          </div>
        </section>

        <section id="faq" className="atlas-section atlas-faq">
          <div className="atlas-shell atlas-faq__grid">
            <div className="atlas-faq__head">
              <SectionOpener numeral={ROMAN[10]}>{FAQ.eyebrow}</SectionOpener>
              <h2 className="atlas-h2">{FAQ.heading}</h2>
            </div>
            <div className="atlas-faq__list">
              {FAQ.items.map((item) => (
                <details key={item.q} className="atlas-faq__item">
                  <summary>
                    <span>{item.q}</span>
                    <ChevronDown className="atlas-faq__chev" aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="atlas-colophon">
        <div className="atlas-shell atlas-colophon__grid">
          <div className="atlas-colophon__brand">
            <Link to="/" className="atlas-brand" aria-label={BRAND.homeLabel}>
              <BrandMark size="h-8 w-8" />
              <span className="atlas-brand__word">
                Academi<em>AI</em>
              </span>
            </Link>
            <p className="atlas-colophon__tagline">{BRAND.tagline}</p>
          </div>
          <nav className="atlas-colophon__links" aria-label="Footer">
            {FOOTER.links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            {!isAuthenticated && <Link to="/login">Sign in</Link>}
          </nav>
          <div className="atlas-colophon__meta">
            <p>Set in Crimson Pro &amp; Atkinson Hyperlegible.</p>
            <p>
              &copy; {new Date().getFullYear()} AcademiAI &middot; Multi-tenant
              &middot; Grounded
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
