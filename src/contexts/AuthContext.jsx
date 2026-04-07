import { createContext, useContext, useState, useCallback, useEffect } from "react";

const TOKEN_KEY = "xmlmonitor_jwt";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(null);

  // On mount: restore and validate any saved token
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setReady(true);
      return;
    }
    fetch("/api/auth/check", { headers: { Authorization: `Bearer ${saved}` } })
      .then((res) => {
        if (res.ok) setToken(saved);
        else localStorage.removeItem(TOKEN_KEY);
      })
      .catch(() => {
        // Server unreachable on mount — keep token; real API calls will handle expiry
        setToken(saved);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback((newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  /** Authenticated fetch — attaches Bearer token and auto-logs-out on 401/403. */
  const apiFetch = useCallback(
    async (url, opts = {}) => {
      const t = localStorage.getItem(TOKEN_KEY);
      const headers = { ...(opts.headers ?? {}) };
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(url, { ...opts, headers });
      if (res.status === 401 || res.status === 403) logout();
      return res;
    },
    [logout]
  );

  return (
    <AuthContext.Provider
      value={{ ready, token, isAuthenticated: !!token, login, logout, apiFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
