import { useTheme } from '@/hooks/useTheme';

/**
 * AcademiAI brand logo (Cinnabar theme-aware).
 * Uses inline SVG so it adapts to the active theme and matches the
 * new landing design. Preserves API: size, variant, className,
 * showWordmark, wordmarkClassName.
 */
const PALETTES = {
  light: {
    badge: '#F8F3EA',
    badgeEdge: '#281E17',
    edgeOpacity: 0.14,
    ringOpacity: 0.08,
    ink: '#281E17',
    accent: '#8A2A24',
  },
  dark: {
    badge: '#211B15',
    badgeEdge: '#F1EBE1',
    edgeOpacity: 0.16,
    ringOpacity: 0.1,
    ink: '#F1EBE1',
    accent: '#E68677',
  },
};

export default function BrandMark({
  size = 'h-12 w-12',
  variant = 'auto',
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
}) {
  const { dark } = useTheme();
  const isDark = variant === 'auto' ? dark : variant === 'dark';
  const p = isDark ? PALETTES.dark : PALETTES.light;

  const mark = (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="AcademiAI"
      className={['shrink-0', size, className].join(' ')}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="16"
        fill={p.badge}
        stroke={p.badgeEdge}
        strokeOpacity={p.edgeOpacity}
      />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="12"
        fill="none"
        stroke={p.badgeEdge}
        strokeOpacity={p.ringOpacity}
      />
      <path
        d="M19.5 45.5 L32 17.5 L44.5 45.5"
        fill="none"
        stroke={p.ink}
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.4 35.4 H38.6"
        fill="none"
        stroke={p.ink}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path
        d="M22 51 H42"
        fill="none"
        stroke={p.accent}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );

  if (showWordmark) {
    return (
      <span className="inline-flex items-center gap-2.5">
        {mark}
        <span
          className={[
            'text-[16px] font-[680] tracking-[-0.02em] text-[var(--fg)]',
            wordmarkClassName,
          ].join(' ')}
        >
          Academi
          <span className="text-[var(--accent-strong)]">AI</span>
        </span>
      </span>
    );
  }
  return mark;
}
