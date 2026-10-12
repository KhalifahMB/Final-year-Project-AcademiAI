import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Gem } from 'lucide-react';
import AtlasLanding from './variants/AtlasLanding';
import CinnabarLanding from './variants/CinnabarLanding';
import './landing-lab.css';

const VARIANTS = [
  {
    id: 'atlas',
    name: 'Atlas',
    icon: Compass,
    blurb: 'Warm academic editorial — spacious, serif-led, bento.',
    Component: AtlasLanding,
  },
  {
    id: 'cinnabar',
    name: 'Cinnabar',
    icon: Gem,
    blurb: 'Console structure, oxblood ink — light and dark.',
    Component: CinnabarLanding,
  },
];

const STORAGE_KEY = 'academiai.landingVariant';

function readInitial() {
  if (typeof window === 'undefined') return VARIANTS[0].id;
  const fromUrl = new URLSearchParams(window.location.search).get('variant');
  if (fromUrl && VARIANTS.some((v) => v.id === fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VARIANTS.some((v) => v.id === stored)) return stored;
  } catch {
    /* storage may be unavailable (private mode) — fall through */
  }
  return VARIANTS[0].id;
}

export default function LandingLab() {
  const [active, setActive] = useState(readInitial);

  const current = useMemo(
    () => VARIANTS.find((v) => v.id === active) || VARIANTS[0],
    [active],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('variant', active);
    window.history.replaceState(null, '', url);
  }, [active]);

  const onKeyDown = useCallback(
    (event) => {
      const i = VARIANTS.findIndex((v) => v.id === active);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(VARIANTS[(i + 1) % VARIANTS.length].id);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(VARIANTS[(i - 1 + VARIANTS.length) % VARIANTS.length].id);
      }
    },
    [active],
  );

  return (
    <div className="lab" data-variant={active}>
      <current.Component />

      <div className="lab-bar" role="region" aria-label="Landing variant picker">
        <Link to="/" className="lab-bar__back">
          <ArrowLeft aria-hidden="true" />
          <span>Live site</span>
        </Link>

        <div
          className="lab-bar__tabs"
          role="tablist"
          aria-label="Choose a landing variant"
          onKeyDown={onKeyDown}
        >
          {VARIANTS.map((v) => {
            const Icon = v.icon;
            const selected = v.id === active;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`lab-tab${selected ? ' lab-tab--active' : ''}`}
                onClick={() => setActive(v.id)}
                title={v.blurb}
              >
                <Icon aria-hidden="true" />
                <span className="lab-tab__name">{v.name}</span>
              </button>
            );
          })}
        </div>

        <p className="lab-bar__blurb" aria-live="polite">
          {current.blurb}
        </p>
      </div>
    </div>
  );
}
