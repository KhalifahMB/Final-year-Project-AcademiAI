import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SearchableSelect — accessible combobox for large option lists.
 *
 * Plain Radix Select renders every item into the DOM, which breaks down
 * for institutions with hundreds of departments/programmes. This renders
 * at most RENDER_LIMIT matches with a type-to-filter input, full keyboard
 * support (ArrowUp/Down, Enter, Escape) and ARIA combobox/listbox wiring.
 *
 * Options: [{ value: string, label: string, hint?: string }]
 */
const RENDER_LIMIT = 100;

function matches(option, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    option.label.toLowerCase().includes(q) ||
    (option.hint || '').toLowerCase().includes(q) ||
    String(option.value).toLowerCase().includes(q)
  );
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches found.',
  loading = false,
  disabled = false,
  id,
  inputId,
  'aria-label': ariaLabel,
  onBlur,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  // Displayed text is derived, never synced in an effect: while open the
  // user is filtering (`query`); while closed the input mirrors the
  // selected label. Opening always starts from a blank filter (an event).
  const displayValue = open ? query : (selected ? selected.label : '');

  const filtered = useMemo(() => {
    if (!open) return options;
    return options.filter((o) => matches(o, query));
  }, [options, open, query]);

  const capped = filtered.length > RENDER_LIMIT;
  const visible = capped ? filtered.slice(0, RENDER_LIMIT) : filtered;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
        onBlur?.();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, close, onBlur]);

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
    setActiveIndex(0);
    onBlur?.();
  };

  const openFromEvent = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !open)) {
      e.preventDefault();
      if (!open) {
        openFromEvent();
        return;
      }
      setActiveIndex((i) => (visible.length ? (i + 1) % visible.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) {
        setActiveIndex((i) =>
          visible.length ? (i - 1 + visible.length) % visible.length : 0,
        );
      }
    } else if (e.key === 'Enter') {
      if (open && visible[activeIndex]) {
        e.preventDefault();
        choose(visible[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
        onBlur?.();
      }
    } else if (e.key === 'Tab') {
      if (open) close();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 transition-colors',
          'focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input
          ref={inputRef}
          id={inputId || id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            if (!disabled) openFromEvent();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Blur without selection reverts on close; commit touched.
            if (!open) onBlur?.();
          }}
          {...rest}
          className="h-full w-full min-w-0 bg-transparent text-[14px] text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" aria-hidden />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            disabled={disabled}
            onClick={() => {
              if (open) close();
              else {
                openFromEvent();
                inputRef.current?.focus();
              }
            }}
            className="shrink-0 text-[var(--muted)]"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
          <p className="border-b border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
            {loading
              ? 'Loading…'
              : searchPlaceholder}
          </p>
          {visible.length === 0 && !loading ? (
            <p className="flex items-center gap-2 px-3 py-3 text-[13px] text-[var(--muted)]">
              <SearchX className="h-4 w-4 shrink-0" aria-hidden />
              {emptyText}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label={ariaLabel || placeholder}
              className="max-h-60 overflow-y-auto p-1"
            >
              {visible.map((o, i) => {
                const isSelected = o.value === value;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      // Select before input blur closes the popup.
                      e.preventDefault();
                      choose(o);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px]',
                      isActive && 'bg-[var(--hover)]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--fg)]">
                        {o.label}
                      </span>
                      {o.hint && (
                        <span className="block truncate text-[11px] text-[var(--muted)]">
                          {o.hint}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {capped && (
            <p className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
              Showing {RENDER_LIMIT} of {filtered.length} matches — keep
              typing to narrow results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
