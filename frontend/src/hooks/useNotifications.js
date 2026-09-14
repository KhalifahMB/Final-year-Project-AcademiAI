import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { notificationsApi } from '@/services/api';

const NOTIFICATIONS_QUERY_KEY = ['notifications'];

function fetchNotifications() {
  if (typeof notificationsApi?.list !== 'function') {
    return Promise.resolve({ results: [], unread_count: 0 });
  }
  return notificationsApi.list();
}

const NOTIFICATIONS_QUERY_OPTIONS = {
  queryKey: NOTIFICATIONS_QUERY_KEY,
  queryFn: fetchNotifications,
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  retry: (failureCount, err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) return false;
    return failureCount < 1;
  },
  refetchInterval: 60_000,
  refetchOnWindowFocus: false,
};

function hasUnreadBadge(notification) {
  return (
    !notification.is_read && (notification.severity === 'warn' || notification.severity === 'critical')
  );
}

/**
 * Notifications feed + badge state, derived on read from the backend feed.
 *
 * `unread` is the intersection of the paginated current page and the badge
 * rule, so it is an optimistic snapshot rather than the authoritative count —
 * use `unreadCount` (from the list response) when you need the true badge
 * number, or `hasUnread` for a simple show/hide decision.
 */
export function useNotifications() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch, isError } = useQuery(
    NOTIFICATIONS_QUERY_OPTIONS,
  );

  const results = data?.results || [];

  const unreadCount = data?.unread_count ?? 0;
  const hasUnread = unreadCount > 0;

  const markRead = useMutation({
    mutationFn: (id) => {
      if (typeof notificationsApi?.markRead !== 'function') {
        return Promise.resolve({ ok: true });
      }
      return notificationsApi.markRead(id);
    },
    onSuccess: (_res, id) => {
      qc.setQueryData(NOTIFICATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        const results = (old.results || []).map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        );
        const unread = (old.results || []).filter(hasUnreadBadge).length;
        return { ...old, results, unread_count: unread };
      });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => {
      if (typeof notificationsApi?.markAllRead !== 'function') {
        return Promise.resolve({ ok: true, updated: 0 });
      }
      return notificationsApi.markAllRead();
    },
    onSuccess: () => {
      qc.setQueryData(NOTIFICATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        const results = (old.results || []).map((n) => ({ ...n, is_read: true }));
        return { ...old, results, unread_count: 0 };
      });
    },
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  return useMemo(
    () => ({
      notifications: results,
      unreadCount,
      hasUnread,
      isLoading,
      isFetching,
      isError,
      refresh,
      markRead: markRead.mutateAsync,
      markAllRead: markAllRead.mutateAsync,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, unreadCount, isLoading, isFetching, isError, refresh, markRead, markAllRead],
  );
}
