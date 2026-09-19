# Shared UI Components (AcademiAI frontend)

Stack: **React 19 + Vite 8** (plain JS, no TypeScript), **Tailwind v4 (CSS-first)**, shadcn/ui-style primitives built on `radix-ui` + `@base-ui/react`. CSS tokens come from `src/styles/tokens.css` exposed as CSS custom properties; utility classes reference them via `var(--token)`. Icons: `lucide-react`. Aliases: `@` → `frontend/src`.

>The landing page (`LandingPage.jsx`) uses only `Button`, `BrandMark`, and `ThemeToggle` from these primitives — everything else on the landing page is hand-rolled CSS in `src/styles/landing.css` (BEM-style `landing-*` classes). If a redesign is produced as a full page it must preserve the landing.css class contract or ship its own CSS.

## Button
- File: `frontend/src/components/ui/button.jsx`
- Base primitive built on `@base-ui/react/button`; variants in `button-variants.js`.

```jsx
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { cloneElement, isValidElement } from 'react';

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  children,
  ...props
}) {
  if (asChild) {
    if (isValidElement(children)) {
      return cloneElement(children, {
        ...props,
        className: cn(
          buttonVariants({ variant, size }),
          className,
          children.props.className,
        ),
      });
    }
    console.warn(
      'Button: asChild is true but children is not a valid React element',
    );
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        'transition-all duration-160 ease-out active:scale-[0.97]',
        buttonVariants({ variant, size, className }),
      )}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  );
}

export { Button };
```

## Button variants
- File: `frontend/src/components/ui/button-variants.js`

```js
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 gap-2 text-[13.5px] tracking-[.01em]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_12%)] shadow-sm",
        outline:
          "border-border-strong bg-surface text-foreground hover:bg-hover aria-expanded:bg-hover dark:border-border dark:bg-surface dark:hover:bg-hover",
        secondary:
          "bg-surface-2 text-foreground hover:bg-hover aria-expanded:bg-hover",
        ghost:
          "text-fg-soft hover:bg-hover aria-expanded:bg-hover dark:hover:bg-hover",
        destructive:
          "bg-danger text-bg hover:bg-[color-mix(in_oklch,var(--danger),black_12%)] shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 px-3.5 rounded-[var(--radius-md)] has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xs: "h-6 rounded-[6px] px-2 text-xs gap-1 [&_svg:not([class*='size-'])]:size-3 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5",
        sm: "h-8 rounded-[var(--radius-md)] px-2.5 text-[13px] gap-1.5 [&_svg:not([class*='size-'])]:size-3.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        lg: "h-[42px] rounded-[var(--radius-md)] px-[18px] text-sm has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        icon: "size-9 rounded-[var(--radius-md)]",
        "icon-xs":
          "size-6 rounded-[6px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[var(--radius-md)]",
        "icon-lg": "size-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## Badge
- File: `frontend/src/components/ui/badge.jsx`

```jsx
import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

## Card
- File: `frontend/src/components/ui/card.jsx`
- NOTE: uses `.card-glass` class defined in `components.css`.

```jsx
import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'card-glass text-[var(--fg)]',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-[18px]', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('font-semibold leading-none tracking-[-0.01em]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-[var(--muted)]', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-[18px] pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-[18px] pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
```

## Input
- File: `frontend/src/components/ui/input.jsx`

```jsx
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
```

## Label
- File: `frontend/src/components/ui/label.jsx`

```jsx
import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

## Dialog
- File: `frontend/src/components/ui/dialog.jsx`

```jsx
import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed start-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] rtl:-translate-x-[-50%] translate-y-[-50%] gap-4 border glass-overlay p-6 shadow-[var(--shadow-pop)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-start',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 rtl:sm:space-x-reverse',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

## BrandMark (official logo)
- File: `frontend/src/components/shared/BrandMark.jsx`
- Official AcademiAI "A + graduation cap + circuit" mark. Uses raster assets `/images/Logo/academiai_icon_light.webp` (light) and `/images/Logo/academiai_icon_dark.png` (dark, wrapped in a white pill).

```jsx
import { useTheme } from '@/hooks/useTheme';

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

  const alt = 'AcademiAI';

  const showDarkAsset = isOnDark || (variant === 'auto' && dark);

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
```

## ThemeToggle
- File: `frontend/src/components/shared/ThemeToggle.jsx`

```jsx
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

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
```

## Other UI primitives (names only)
Located in `frontend/src/components/ui/`: `tooltip.jsx`, `textarea.jsx`, `tabs.jsx`, `table.jsx`, `sonner.jsx`, `separator.jsx`, `select.jsx`, `password-input.jsx`, `form.jsx`, `dropdown-menu.jsx`, `checkbox.jsx`, `alert.jsx`, `alert-dialog.jsx`. Standard shadcn/Radix implementations over the token set in `theme.md`.

## Shared app components (names only)
Located in `frontend/src/components/shared/`: `Avatar.jsx`, `AvatarPicker.jsx`, `AsyncState.jsx`, `EmptyState.jsx`, `EntityDialog.jsx`, `ConfirmDialog.jsx`, `Pagination.jsx`, `PageHeader.jsx`, `OnlineStatus.jsx`, `SearchableSelect.jsx`, `TemplateEditorDialog.jsx`, `StatusBadge.jsx`, `SkeletonRows.jsx`, `StatCard.jsx`, `StatTile.jsx`, `AiInsightCard.jsx`.

Common components in `frontend/src/components/common/`: `RouteLoading.jsx`, `NotFoundPage.jsx`, `ForbiddenPage.jsx`, `ErrorBoundary.jsx`, `CommandPalette.jsx`.