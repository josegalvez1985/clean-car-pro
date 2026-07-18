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
    const raw = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (!raw) return;

    let stored: AuthUser;
    try {
      stored = JSON.parse(raw);
    } catch {
      return;
    }

    // Con API configurada, una sesión sin token no es válida: descartarla.
    if (!API_BASE_URL) {
      setUser(stored);
      return;
    }
    if (!stored.token) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then((res) => {
        if (res.ok) setUser(stored);
        else localStorage.removeItem(STORAGE_KEY); // token expirado/ inválido
      })
      .catch(() => {
        // Sin red: mantener la sesión guardada para no expulsar al usuario.
        setUser(stored);
      });
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Usuario o contraseña inválidos");
        }
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
        throw new Error(
          "API no configurada (VITE_API_URL). Reiniciá el servidor de desarrollo.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Invalidar el token en el backend (best-effort; no bloquea el cierre).
    if (API_BASE_URL && user?.token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: user.token }),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    }
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