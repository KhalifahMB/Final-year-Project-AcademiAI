/**
 * AcademiAI brand logo.
 *
 * Renders the official AcademiAI "A + graduation cap + circuit" mark.
 * In light mode we show the full-colour mark on white; on dark surfaces we
 * place the same mark inside a soft white pill so the gradient stays
 * readable. A "solid" variant is provided for the auth dark panel.
 */
export default function BrandMark({
  size = 'h-7 w-7',
  variant = 'auto',
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
}) {
  const isOnDark = variant === 'dark';     // rendered on a dark surface
  const isOnLight = variant === 'light';   // rendered on a light surface
  // variant === 'auto' — adapts to theme via dark: classes

  const src = '/images/Logo/academiai_icon_light.webp';
  const alt = 'AcademiAI';

  const imgNode = (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={[
        'block h-full w-full object-contain select-none',
        isOnDark
          ? ''
          : isOnLight
            ? ''
            : '',
      ].join(' ')}
    />
  );

  // On dark surfaces we wrap the light-bg logo in a rounded white tile so
  // the white background of the asset blends with the tile.
  const mark = isOnDark ? (
    <span
      className={[
        'inline-grid shrink-0 place-items-center rounded-[8px] bg-white/95 p-[3px] shadow-[0_1px_0_rgba(255,255,255,0.08)]',
        size,
        className,
      ].join(' ')}
      aria-hidden
    >
      {imgNode}
    </span>
  ) : (
    <span
      className={[
        'inline-grid shrink-0 place-items-center',
        size,
        // On auto variant, in dark mode render the white tile; on light mode
        // render raw asset (so it blends with page).
        isOnLight
          ? ''
          : 'dark:rounded-[8px] dark:bg-white/95 dark:p-[3px] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]',
        className,
      ].join(' ')}
      aria-hidden
    >
      {imgNode}
    </span>
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
          AcademiAI
        </span>
      </span>
    );
  }
  return mark;
}
