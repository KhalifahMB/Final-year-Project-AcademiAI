/**
 * AcademiAI logo — brand-spec "square A" mark.
 *
 * The Open Design spec uses a 28px dark square with white "A" (light mode)
 * and a light square with dark "A" (dark mode). We render this as a
 * self-contained glyph to avoid asset dependency; the image assets
 * remain available for the landing page.
 */
export default function BrandMark({ size = "h-7 w-7", variant = "auto" }) {
  const isDark = variant === "dark";
  const isLight = variant === "light";
  // variant="auto" adapts to theme via dark: classes
  return (
    <span
      className={[
        'inline-grid shrink-0 place-items-center rounded-[7px] font-[700] tracking-[-0.02em] select-none',
        size,
        isDark
          ? 'bg-[var(--fg)] text-[var(--bg)]'
          : isLight
            ? 'bg-[var(--bg)] text-[var(--fg)]'
            : 'bg-[var(--fg)] text-[var(--bg)] dark:bg-[var(--fg)] dark:text-[var(--bg)]',
      ].join(' ')}
      aria-hidden
    >
      A
    </span>
  );
}
