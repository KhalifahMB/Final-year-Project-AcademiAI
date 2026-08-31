import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Theme toggle. Two modes:
 *  - iconOnly: compact square icon button for rails/topbar.
 *  - default: full-width labelled item for the sidebar footer.
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
          ? 'theme-btn inline-flex items-center justify-center text-[var(--fg-soft)] hover:bg-[var(--hover)] hover:text-[var(--fg)]'
          : 'inline-flex h-9 w-full items-center justify-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] font-[520] text-[var(--fg-soft)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
        className,
      )}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      {!iconOnly && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}
