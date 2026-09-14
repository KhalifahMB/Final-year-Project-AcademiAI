import { authApi } from '@/services/api';
import { clearSessionFlag, hasSessionFlag } from '@/lib/session';

export const USER_QUERY_KEY = ['auth', 'me'];

// In-memory dedupe guard so that even if multiple AuthProvider mounts race
// during React 19 StrictMode double-invoke, or multiple components subscribe
// before the first fetch resolves, only ONE HTTP request is in flight. TanStack
// already dedupes useQuery callers on the same QueryClient; this guard also
// handles (a) components that hit the fallback branch (new QueryClient per
// test/edge case), and (b) transient StrictMode re-mounts.
let inflight = null;

export async function fetchUser() {
  // The JWT lives in an HttpOnly cookie (inaccessible to JS). The session
  // flag only short-circuits the /auth/me probe for anonymous visitors.
  if (!hasSessionFlag()) return null;

  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const user = await authApi.me();
      return user ?? null;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        clearSessionFlag();
        return null;
      }
      throw err;
    } finally {
      if (inflight === promise) inflight = null;
    }
  })();

  inflight = promise;
  return promise;
}

// Stable, shared query options so every useQuery subscribing to
// ['auth','me'] uses identical caching/dedupe behaviour.
export const AUTH_QUERY_OPTIONS = {
  queryKey: USER_QUERY_KEY,
  queryFn: fetchUser,
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  retry: (failureCount, err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) return false;
    return failureCount < 1;
  },
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  notifyOnChangeProps: ['data', 'error', 'isLoading'],
};