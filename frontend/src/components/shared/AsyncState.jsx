import { cn } from '@/lib/utils';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingState({ message = 'Loading...', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="mt-3 text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      </div>
      <p className="mt-3 text-[13px] font-medium">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyStateFull({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  actionTo,
  onAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-3 text-[13px] font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{description}</p>
      )}
      {action && (onAction || actionTo) && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onAction}
          asChild={!!actionTo}
        >
          {actionTo ? <a href={actionTo}>{action}</a> : <span>{action}</span>}
        </Button>
      )}
    </div>
  );
}

export default function AsyncState({
  isLoading,
  isError,
  error,
  data,
  onRetry,
  loadingMessage,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  emptyOnAction,
  children,
  className,
}) {
  if (isLoading) return <LoadingState message={loadingMessage} className={className} />;
  if (isError) return <ErrorState message={error?.message} onRetry={onRetry} className={className} />;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <EmptyStateFull
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
        onAction={emptyOnAction}
        className={className}
      />
    );
  }
  return children;
}
