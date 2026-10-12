import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { AUTH_QUERY_OPTIONS, USER_QUERY_KEY } from '@/services/authQuery';
import { go } from '@/lib/navigation';
import {
  clearSessionFlag,
  clearUserScopedStorage,
  setSessionFlag,
} from '@/lib/session';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery(AUTH_QUERY_OPTIONS);

  const login = useCallback(
    async (email, password) => {
      const result = await authApi.login({ email, password });
      setSessionFlag();
      qc.setQueryData(USER_QUERY_KEY, result.user);
      return result;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore — local cleanup must happen regardless */
    }
    clearSessionFlag();
    clearUserScopedStorage();
    qc.setQueryData(USER_QUERY_KEY, null);
    qc.clear();
    go('/');
  }, [qc]);

  const reload = useCallback(
    () => qc.invalidateQueries({ queryKey: USER_QUERY_KEY }),
    [qc],
  );

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

    [user, isLoading, error, login, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
