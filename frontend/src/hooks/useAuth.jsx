/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/services/api";
import { clearSessionFlag, hasSessionFlag, setSessionFlag } from "@/lib/session";

const AuthContext = createContext(null);
export const USER_QUERY_KEY = ["auth", "me"];

// In-memory dedupe guard so that even if multiple AuthProvider mounts race
// during React 19 StrictMode double-invoke, or multiple components subscribe
// before the first fetch resolves, only ONE HTTP request is in flight. TanStack
// already dedupes useQuery callers on the same QueryClient; this guard also
// handles (a) components that hit the fallback branch (new QueryClient per
// test/edge case), and (b) transient StrictMode re-mounts.
let inflight = null;

async function fetchUser() {
  // The JWT lives in an HttpOnly cookie (inaccessible to JS). The session
  // flag only short-circuits the /auth/me probe for anonymous visitors.
  if (!hasSessionFlag()) return null;

  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data } = await authApi.me();
      return data;
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
  notifyOnChangeProps: ["data", "error", "isLoading"],
};

export function AuthProvider({ children }) {
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery(AUTH_QUERY_OPTIONS);

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    setSessionFlag();
    qc.setQueryData(USER_QUERY_KEY, data.user);
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore — local cleanup must happen regardless */
    }
    clearSessionFlag();
    qc.setQueryData(USER_QUERY_KEY, null);
    qc.clear();
    window.location.assign("/");
  };

  const reload = () => qc.invalidateQueries({ queryKey: USER_QUERY_KEY });

  const value = useMemo(
    () => ({
      user: user ?? null,
      loading: isLoading,
      error,
      login,
      logout,
      reload,
      isAuthenticated: !!user,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading, error, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  // Normal path: AuthProvider is mounted — context gives us a single
  // shared subscription with zero extra HTTP requests.
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  // Fallback for isolated tests / code accidentally rendered outside
  // the provider — reuses the same cache key and deduped queryFn so we
  // never fire duplicate HTTP requests here either.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const qc = useQueryClient();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data, isLoading, error } = useQuery(AUTH_QUERY_OPTIONS);
  return {
    user: data ?? null,
    loading: isLoading,
    error: error ?? null,
    login: async () => {
      throw new Error("AuthProvider not mounted");
    },
    logout: () => {
      clearSessionFlag();
      qc.setQueryData(USER_QUERY_KEY, null);
      window.location.assign("/");
    },
    reload: () => qc.invalidateQueries({ queryKey: USER_QUERY_KEY }),
    isAuthenticated: !!data,
  };
}
