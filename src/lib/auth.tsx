import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "cleancar.auth";
// Configure your Oracle-backed REST API base URL here (or via VITE_API_URL).
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface AuthUser {
  username: string;
  token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) throw new Error("Usuario o contraseña inválidos");
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          user?: { username?: string };
        };
        const next: AuthUser = {
          username: data.user?.username ?? username,
          token: data.token,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
      } else {
        // Sin API configurada: login local para poder probar la app.
        if (!username || !password) throw new Error("Ingresá usuario y contraseña");
        const next: AuthUser = { username };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}