import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "./api";

const STORAGE_KEY = "cleancar.auth";
// Configure your Oracle-backed REST API base URL here (or via VITE_API_URL).
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface AuthUser {
  username: string;
  token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** true mientras se lee la sesión de localStorage; evita redirigir al login. */
  restaurando: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Getters sueltos: el cliente HTTP no es React y necesita leer la sesión
// sin hooks (ver src/lib/api.ts).
function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return readStored()?.token ?? null;
}

export function getStoredUsername(): string | null {
  return readStored()?.username ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  // Arranca en true: hasta leer localStorage no sabemos si hay sesión, y sin
  // esto las páginas protegidas redirigen al login en el primer render.
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    const raw = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (!raw) {
      setRestaurando(false);
      return;
    }

    let stored: AuthUser;
    try {
      stored = JSON.parse(raw);
    } catch {
      setRestaurando(false);
      return;
    }

    // Con API configurada, una sesión sin token no es válida: descartarla.
    if (!API_BASE_URL) {
      setUser(stored);
      setRestaurando(false);
      return;
    }
    if (!stored.token) {
      localStorage.removeItem(STORAGE_KEY);
      setRestaurando(false);
      return;
    }

    // Mostrar la sesión guardada ya mismo y revalidar en segundo plano: así la
    // app no parpadea mientras /auth/me responde.
    setUser(stored);
    setRestaurando(false);

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then((res) => {
        if (!res.ok) {
          // Token expirado o inválido: cerrar sesión.
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      })
      .catch(() => {
        // Sin red: mantener la sesión guardada para no expulsar al usuario.
      });
  }, []);

  // Cuando api.ts recibe 401/403 limpia la sesión y la app vuelve al login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      if (API_BASE_URL) {
        // APEX guarda los usuarios en MAYÚSCULAS: normalizar antes de enviar.
        const normalizedUsername = username.trim().toUpperCase();

        let res: Response;
        try {
          res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: normalizedUsername, password }),
          });
        } catch {
          throw new Error("No se pudo conectar con el servidor");
        }

        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          token?: string;
          user?: { username?: string };
          error?: string;
          message?: string;
        };

        // ORDS puede responder 200 con success:false; también es un fallo.
        if (res.status === 401 || data.success === false) {
          throw new Error(data.error ?? data.message ?? "Usuario o contraseña inválidos");
        }
        if (!res.ok || !data.token) {
          throw new Error(data.error ?? data.message ?? "Error al iniciar sesión");
        }

        const next: AuthUser = {
          username: data.user?.username ?? normalizedUsername,
          token: data.token,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
      } else {
        throw new Error("API no configurada (VITE_API_URL). Reiniciá el servidor de desarrollo.");
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
    <AuthContext.Provider value={{ user, loading, restaurando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
