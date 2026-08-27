import { useEffect, useState, useCallback, useRef } from "react";
import { authApi } from "@/services/api";

// Module-level promise so concurrent mount() calls share a single /auth/me/
// round-trip instead of firing N requests (StrictMode double-mount +
// every AppShell + OnlineStatus + Avatar component used to multiply calls).
let inflightMe = null;

function fetchMe() {
  if (inflightMe) return inflightMe;
  const token = localStorage.getItem("access_token");
  if (!token) return Promise.resolve(null);
  inflightMe = authApi
    .me()
    .then((r) => r.data)
    .catch(() => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return null;
    })
    .finally(() => {
      inflightMe = null;
    });
  return inflightMe;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMe();
      if (mounted.current) setUser(data);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadUser();
    return () => {
      mounted.current = false;
    };
  }, [loadUser]);

  // Listen for token changes across tabs so we don't show stale user state.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "access_token") loadUser();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
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
    setUser(null);
    window.location.assign("/");
  };

  return { user, loading, login, logout, reload: loadUser, isAuthenticated: !!user };
}
