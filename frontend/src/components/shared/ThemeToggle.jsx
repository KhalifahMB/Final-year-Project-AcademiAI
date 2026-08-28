import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Theme toggle. When `iconOnly` is true renders a compact square button
 * suitable for nav rails; otherwise renders a full-width labelled button
 * (for sidebars/settings).
 */
export default function ThemeToggle({ className = '', iconOnly = false }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        iconOnly
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring'
          : 'inline-flex h-9 w-full items-center justify-start gap-2 rounded-md border border-sidebar-border/70 bg-sidebar/50 px-2.5 text-[12px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {dark ? <Sun className="h-[17px] w-[17px]" aria-hidden /> : <Moon className="h-[17px] w-[17px]" aria-hidden />}
      {!iconOnly && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}
