export default function SkeletonRows({ rows = 4, className = "" }) {
  return (
    <div className={`space-y-2.5 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-muted"
          style={{ animationDelay: `${i * 80}ms`, opacity: 1 - i * 0.12 }}
        />
      ))}
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
