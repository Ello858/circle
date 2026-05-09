import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient, getToken, setToken } from "../api";
import type { User } from "../types";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTok] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await apiClient.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          setToken(null);
          setTok(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await apiClient.login({ username, password });
    setToken(r.token);
    setTok(r.token);
    setUser(r.user);
  }, []);

  const register = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const r = await apiClient.register({
        username,
        password,
        display_name: displayName,
      });
      setToken(r.token);
      setTok(r.token);
      setUser(r.user);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
