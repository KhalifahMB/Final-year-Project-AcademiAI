import { createContext, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/services/api";

const AuthContext = createContext(null);
export const USER_QUERY_KEY = ["auth", "me"];

async function fetchUser({ signal }) {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const { data } = await authApi.me();
    return data;
  } catch (err) {
    // Only wipe tokens on 401; network errors should leave state intact so a
    // transient offline blip doesn't log the user out.
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return null;
    }
    throw err;
  }
}

export function AuthProvider({ children }) {
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchUser,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    qc.setQueryData(USER_QUERY_KEY, data.user);
    return data;
  };

  const logout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      await authApi.logout(refresh);
    } catch {
      /* ignore — local cleanup must happen regardless */
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
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
  // If the provider is mounted, prefer it (single cached query, no extra
  // requests). Fall back to an inline useQuery so isolated tests or pages
  // accidentally rendered outside the provider still work.
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const qc = useQueryClient();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data, isLoading } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchUser,
    staleTime: 60_000,
    retry: (c, err) => c < 1 && err?.response?.status !== 401,
    refetchOnWindowFocus: false,
  });
  return {
    user: data ?? null,
    loading: isLoading,
    error: null,
    login: async () => {
      throw new Error("AuthProvider not mounted");
    },
    logout: () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      qc.setQueryData(USER_QUERY_KEY, null);
      window.location.assign("/");
    },
    reload: () => qc.invalidateQueries({ queryKey: USER_QUERY_KEY }),
    isAuthenticated: !!data,
  };
}
