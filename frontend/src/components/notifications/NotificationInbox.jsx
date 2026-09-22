import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const SEVERITY_COLOR = {
  info: 'var(--info)',
  warn: 'var(--warn)',
  critical: 'var(--danger)',
};

function timeAgo(iso) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export default function NotificationInbox() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const hasUnreadRows = notifications.some((n) => !n.is_read);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
          className="icon-tile relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 && (
            <span
              className="num absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9.5px] font-[620] text-[var(--on-accent)]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-pop)]"
      >
        <DropdownMenuLabel className="eyebrow px-2 py-1.5">
          Notifications
        </DropdownMenuLabel>
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[12.5px] font-[560] text-[var(--fg)]">
              You&apos;re all caught up
            </p>
            <p className="text-caption mt-0.5">
              Alerts about your courses and library show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[min(60vh,420px)] overflow-y-auto">
              {notifications.map((n) => {
                const row = (
                  <>
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          SEVERITY_COLOR[n.severity] || 'var(--muted)',
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-[12.5px] leading-snug text-[var(--fg)]',
                          !n.is_read && 'font-[600]',
                        )}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="text-caption mt-0.5 block">
                          {n.body}
                        </span>
                      )}
                      <span className="text-mono-meta mt-1 block">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </>
                );
                const onOpen = () => {
                  if (!n.is_read) markRead(n.id).catch(() => {});
                };
                return n.link ? (
                  <DropdownMenuItem
                    key={n.id}
                    asChild
                    className="h-auto items-start gap-2 rounded-[var(--radius-sm)] px-2 py-2"
                  >
                    <Link to={n.link} onClick={onOpen}>
                      {row}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={n.id}
                    onSelect={onOpen}
                    className="h-auto items-start gap-2 rounded-[var(--radius-sm)] px-2 py-2"
                  >
                    {row}
                  </DropdownMenuItem>
                );
              })}
            </div>
            {hasUnreadRows && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => markAllRead().catch(() => {})}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-[12px] font-[560] text-[var(--fg-soft)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
                >
                  <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Mark all read
                </button>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
