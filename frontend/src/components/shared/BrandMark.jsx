import { useTheme } from '@/hooks/useTheme';

/**
 * AcademiAI brand logo.
 *
 * Renders the official AcademiAI "A + graduation cap + circuit" mark.
 * In light mode we show the full-colour mark on white; in dark mode we
 * show the dark variant inside a soft white pill so the gradient stays
 * readable. A "solid" variant is provided for the auth dark panel.
 */
export default function BrandMark({
  size = 'h-7 w-7',
  variant = 'auto',
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
}) {
  const { dark } = useTheme();
  const isCurrentDark = variant === 'auto' ? dark : variant === 'dark';
  const isOnDark = isCurrentDark;
  // const isOnLight = !isCurrentDark;

  console.log('CuureentDark', isCurrentDark);

  const alt = 'AcademiAI';

  // Show dark asset when: forced dark variant OR auto + dark theme active
  const showDarkAsset = isOnDark || (variant === 'auto' && dark);

  // Always wrap dark assets in white pill for contrast
  const mark = showDarkAsset ? (
    <span
      className={[
        'inline-grid shrink-0 place-items-center rounded-[8px] bg-white/95 p-[3px] shadow-[0_1px_0_rgba(255,255,255,0.08)]',
        size,
        className,
      ].join(' ')}
      aria-hidden
    >
      <img
        src="/images/Logo/academiai_icon_dark.png"
        alt={alt}
        draggable={false}
        className="block h-full w-full select-none object-contain"
      />
    </span>
  ) : (
    <span
      className={[
        'inline-grid shrink-0 place-items-center rounded-[8px] p-[3px] shadow-[0_1px_0_rgba(255,255,255,0.08)]',
        size,
        className,
      ].join(' ')}
      aria-hidden
    >
      <img
        src="/images/Logo/academiai_icon_light.webp"
        alt={alt}
        draggable={false}
        className="block h-full w-full select-none object-contain"
      />
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
