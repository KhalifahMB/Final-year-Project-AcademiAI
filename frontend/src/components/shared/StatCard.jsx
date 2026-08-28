import { cn } from "@/lib/utils";

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
  trend,
  trendDirection = "up",
  className,
}) {
  const accentMap = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card card-surface-hover",
        className
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 bg-gradient-to-b from-primary to-primary/40 transition-transform duration-300 group-hover:scale-y-100" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-[1.6rem] font-semibold tracking-tight tabular-nums">
            {value ?? "—"}
          </p>
          {hint && trend ? null : hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
          {trend ? (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                trendDirection === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trendDirection === "up" ? "▲" : "▼"} {trend}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              accentMap[accent] || accentMap.primary
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
