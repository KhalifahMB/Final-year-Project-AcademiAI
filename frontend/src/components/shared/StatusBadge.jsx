import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  ready: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  pending: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25",
  processing: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25",
  failed: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/25",
  published: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  draft: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300 border-zinc-500/25",
  archived: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
  enrolled: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  dropped: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
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
