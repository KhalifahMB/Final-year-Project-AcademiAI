import { cn } from '@/lib/utils';

/**
 * Landing-section plates: wordless line art that carries a section's argument
 * before the copy has to. Same reasoning as illustrations.jsx — an <img> file
 * is an isolated document and cannot read the app's custom properties, so
 * theme-aware art has to be inlined.
 */
function Plate({ className, children, ...props }) {
  return (
    <svg
      viewBox="0 0 320 240"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('h-auto w-full', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Two stacks of documents on rails that never meet — the fragmentation the
 *  problem section describes, drawn instead of restated. */
export function FragmentedMaterialsPlate(props) {
  return (
    <Plate {...props}>
      <path d="M56 36h48a4 4 0 0 1 4 4v84" />
      <path d="M44 48h48a4 4 0 0 1 4 4v76a4 4 0 0 1-4 4H44a4 4 0 0 1-4-4V52a4 4 0 0 1 4-4Z" />
      <path d="M52 68h32M52 80h32M52 92h20" />
      <path d="M264 36h-48a4 4 0 0 0-4 4v84" />
      <path d="M228 48h48a4 4 0 0 1 4 4v76a4 4 0 0 1-4 4H228a4 4 0 0 1-4-4V52a4 4 0 0 1 4-4Z" />
      <path d="M236 68h32M236 80h32M236 92h20" />
      <path d="M40 176h96M184 176h96" />
      <circle cx="160" cy="176" r="8" stroke="var(--accent)" />
    </Plate>
  );
}
