import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  ready: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  pending: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/25",
  processing: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
  failed: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
  published: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  draft: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  archived: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  enrolled: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/25",
  completed: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  dropped: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  active: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
};

export default function StatusBadge({ status, className }) {
  const key = String(status || "").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[key] || "bg-muted text-muted-foreground border-border",
        className
      )}
    >
      {key === "processing" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      ) : null}
      {status}
    </span>
  );
}
