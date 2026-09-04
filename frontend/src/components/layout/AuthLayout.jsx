import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';
import { Button } from '@/components/ui/button';

/**
 * AuthLayout — landing-editorial edition.
 *
 * Unifies every auth page (/login, /signup, /verify-email, /password-reset,
 * /request-institution) with the public landing system: paper canvas, serif
 * display type, teal eyebrow/links, hairline panel card, and the same
 * sticky nav + footer. No glass, no indigo glow — one voice everywhere.
 */
export default function AuthLayout({
  title,
  subtitle,
  icon: Icon,
  footer,
  children,
  eyebrow,
}) {
  return (
    <div className="landing-page landing-auth">
      <header className="landing-nav">
        <div className="landing-shell landing-nav__inner">
          <Link to="/" className="landing-brand" aria-label="AcademiAI home">
            <BrandMark size="h-8 w-8" />
            <span>AcademiAI</span>
          </Link>
          <nav className="landing-nav__links" aria-label="Landing page sections">
            <Link to="/#model">The model</Link>
            <Link to="/#institutions">Institutions</Link>
          </nav>
          <div className="landing-nav__actions">
            <ThemeToggle className="landing-theme-btn" iconOnly />
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
          </div>
        </div>
      </header>

      <main className="landing-auth__main">
        <div className="landing-shell landing-auth__grid">
          <div className="landing-auth__copy">
            {eyebrow && (
              <p className="landing-eyebrow">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                {eyebrow}
              </p>
            )}
            <h1>{title}</h1>
            {subtitle && <p className="landing-lede">{subtitle}</p>}
            <div className="landing-proofline">
              <span>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Tenant-isolated
              </span>
              <span>
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Built for universities
              </span>
            </div>

            <div className="landing-tutor-wrap landing-auth__tutor" aria-hidden="true">
              <div className="landing-tutor">
                <div className="landing-tutor__topline">
                  <span className="landing-tutor__dots">
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
                    The divide-and-conquer steps split the input into
                    logarithmic levels, while each level processes all n items
                    once.
                  </div>
                  <span className="landing-tutor__citation">
                    SOURCE / Algorithms-lecture-03.pdf / p.18 / 0.94
                  </span>
                </div>
              </div>
              <div className="landing-tutor__caption">
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>
                  Every useful answer can take you back to the page it came
                  from.
                </span>
              </div>
            </div>
          </div>

          <div className="landing-auth__cardwrap">
            <section
              className="landing-auth__card"
              aria-label={typeof title === 'string' ? title : 'Account form'}
            >
              {Icon && (
                <div className="landing-auth__card-top">
                  <span className="landing-auth__icon" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="landing-auth__card-kicker">
                    Secure &amp; institution-scoped
                  </span>
                </div>
              )}
              <div className="landing-auth__form">{children}</div>
              {footer && (
                <p className="landing-auth__footer">{footer}</p>
              )}
            </section>
            <p className="landing-auth__aside">
              Protected by database-layer isolation. Your materials never leave
              your institution boundary.
            </p>
          </div>
        </div>
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
