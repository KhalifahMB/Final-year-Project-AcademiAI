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
