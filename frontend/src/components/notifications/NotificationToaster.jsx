import { useEffect } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const SHOWN_KEY = 'academiai:alert-toasts-shown';

/**
 * Surfaces unread warn/critical notifications as auto-dismissible toasts.
 *
 * Deduped per browser session (ids recorded in sessionStorage) so a given
 * alert toasts at most once. Does NOT mark notifications read — the orb
 * badge stays until the user opens the agent panel.
 */
export default function NotificationToaster() {
  const { notifications, isLoading } = useNotifications();

  useEffect(() => {
    if (isLoading) return;
    const unread = notifications.filter(
      (n) =>
        n?.id &&
        !n.is_read &&
        (n.severity === 'warn' || n.severity === 'critical'),
    );
    if (unread.length === 0) return;

    let shown = new Set();
    try {
      const raw = window.sessionStorage.getItem(SHOWN_KEY);
      if (raw) shown = new Set(JSON.parse(raw));
    } catch {
      /* ignore storage errors */
    }

    let changed = false;
    unread.forEach((n) => {
      if (shown.has(n.id)) return;
      shown.add(n.id);
      changed = true;
      const Icon = n.severity === 'critical' ? ShieldAlert : AlertTriangle;
      toast(
        n.severity === 'critical' ? 'Action needed' : 'Heads-up',
        {
          description: n.message,
          icon: <Icon className="h-4 w-4" aria-hidden />,
          duration: 8000,
        },
      );
    });

    if (changed) {
      try {
        window.sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]));
      } catch {
        /* ignore storage errors */
      }
    }
  }, [notifications, isLoading]);

  return null;
}