/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { AUTH_QUERY_OPTIONS, USER_QUERY_KEY } from '@/services/authQuery';
import { go } from '@/lib/navigation';
import { clearSessionFlag, setSessionFlag } from '@/lib/session';

export const AuthContext = createContext(null);

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
    go('/');
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