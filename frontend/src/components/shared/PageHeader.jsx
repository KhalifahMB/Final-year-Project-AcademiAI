import { cn } from '@/lib/utils';

export default function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}) {
  return (
    <div className={cn('mb-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1 text-[12px] text-muted-foreground">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-border" aria-hidden>/</span>}
                  {isLast || !crumb.to ? (
                    <span className="font-medium text-foreground" aria-current={isLast ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  ) : (
                    <a href={crumb.to} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
