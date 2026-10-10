import { cn } from '@/lib/utils';

/**
 * StatStrip — a row of StatTiles sharing ONE hairline panel with internal
 * hairline dividers (Colophon rebrand: fewer boxes, hairlines do the work).
 *
 * Children are expected to be <StatTile>s: the strip flattens their
 * individual borders and radii, gives each equal width, and divides them
 * with 1px rules. Overflows to horizontal scroll on narrow screens
 * (DESIGN.md → Responsive Behavior). Tiles used outside a strip keep
 * their standalone bordered look.
 */
export default function StatStrip({ children, className, 'data-testid': testId }) {
  return (
    <div className={cn('kpi-strip', className)} data-testid={testId}>
      {children}
    </div>
  );
}
