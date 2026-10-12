import { useTheme } from '@/hooks/useTheme';

/**
 * Cinnabar — token-driven mark for the Console-structured, oxblood landing
 * variant. A rounded badge holds a geometric "A" over a single oxblood
 * citation rule (the "cited" promise, drawn). Inline SVG so it reads the
 * active theme and stays crisp at any size: badge and ink track the global
 * surface/foreground tokens, and the single accent detail is the citation
 * rule — per DESIGN.md ("currentColor plus exactly one var(--accent)").
 */
export default function CinnabarMark({
  size = 'h-9 w-9',
  variant = 'auto',
  className = '',
  withWordmark = false,
  wordmarkClassName = '',
}) {
  const { dark } = useTheme();
  // Edge strokes draw at slightly different opacities on light vs dark so the
  // hairline reads at the same strength on both grounds.
  const isDark = variant === 'auto' ? dark : variant === 'dark';
  const edgeOpacity = isDark ? 0.16 : 0.14;
  const ringOpacity = isDark ? 0.1 : 0.08;

  const mark = (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="AcademiAI Cinnabar"
      className={['shrink-0', size, className].join(' ')}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="16"
        fill="var(--surface)"
        stroke="var(--fg)"
        strokeOpacity={edgeOpacity}
      />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="12"
        fill="none"
        stroke="var(--fg)"
        strokeOpacity={ringOpacity}
      />
      <path
        d="M19.5 45.5 L32 17.5 L44.5 45.5"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.4 35.4 H38.6"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path
        d="M22 51 H42"
        fill="none"
        stroke="var(--accent-strong)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );

  if (!withWordmark) return mark;

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
