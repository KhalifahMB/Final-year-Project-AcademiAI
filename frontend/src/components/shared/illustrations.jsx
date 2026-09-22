import { cn } from '@/lib/utils';

/**
 * Empty-state illustrations — monoline, 96×96, hairline stroke.
 *
 * They are inline SVG rather than image files on purpose: an `<img src>` can't
 * read the app's CSS custom properties, so a raster or external-SVG asset would
 * need a second dark-mode copy and would hardcode a hue. `currentColor` lets
 * the surrounding text colour carry the shape and `var(--accent)` carries the
 * single detail, so both themes are covered by one source.
 *
 * Rules (DESIGN.md → Illustrations): no fills, no baked-in text, no numbers or
 * claims that could go stale, and always decorative — the EmptyState title is
 * what screen readers announce.
 */
function Illustration({ className, children, ...props }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('h-24 w-24', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export function EmptyCoursesIllustration(props) {
  return (
    <Illustration {...props}>
      <path d="M22 34V22a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v12" />
      <path d="M18 34h60a5 5 0 0 1 5 5v35a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V39a5 5 0 0 1 5-5Z" />
      <path d="M28 58h20M28 68h28" />
      <path d="M60 34v15l-4.5-3.5-4.5 3.5V34" stroke="var(--accent)" />
    </Illustration>
  );
}

export function EmptyResourcesIllustration(props) {
  return (
    <Illustration {...props}>
      <path d="M28 16h26l16 15v49a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4Z" />
      <path d="M54 16v15h16" stroke="var(--accent)" />
      <path d="M36 44h24M36 55h24M36 66h14" />
    </Illustration>
  );
}

export function EmptyCalendarIllustration(props) {
  return (
    <Illustration {...props}>
      <path d="M18 24h60a4 4 0 0 1 4 4v52a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4Z" />
      <path d="M14 38h68M32 24V16M64 24V16" />
      <path d="M28 50h6M54 50h6M67 50h6M28 61h6M54 61h6M67 61h6M28 72h6M41 72h6M54 72h6M67 72h6" />
      <circle cx="43.5" cy="61" r="9" stroke="var(--accent)" />
    </Illustration>
  );
}

export function EmptyChatIllustration(props) {
  return (
    <Illustration {...props}>
      <path d="M20 24h56a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H46l-12 11V62h-14a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4Z" />
      <path d="M28 36h40M28 47h26" />
      <circle cx="70" cy="72" r="9" stroke="var(--accent)" />
      <path d="m66 72 3 3 6-6" stroke="var(--accent)" />
    </Illustration>
  );
}
