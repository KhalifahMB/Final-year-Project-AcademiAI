import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[14px] transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--fg)]',
        'placeholder:text-[var(--muted)]',
        'focus-visible:outline-none focus-visible:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
