import { clearStoredSession, getStoredToken } from "./auth";

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// El AuthProvider registra acá cómo cerrar sesión, para que api.ts (que no es
// React) pueda expulsar al usuario cuando el token expira.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/**
 * Error de sesión expirada (401/403). Se distingue del resto para que las
 * pantallas NO lo muestren como cartel: la sesión ya se cerró y la app está
 * redirigiendo al login, así que pintar un error sería ruido.
 */
export class SesionExpiradaError extends Error {
  constructor(message = "Sesión expirada. Ingresá de nuevo.") {
    super(message);
    this.name = "SesionExpiradaError";
  }
}

/**
 * Mensaje a mostrar, o null si el error es de sesión expirada (en ese caso la
 * app ya está volviendo al login y no hay que pintar nada).
 */
export function mensajeError(e: unknown, fallback: string): string | null {
  if (e instanceof SesionExpiradaError) return null;
  return e instanceof Error ? e.message : fallback;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new Error("VITE_API_URL no configurada");

  // Content-Type solo cuando hay cuerpo: en un DELETE sin body, ORDS intenta
  // parsear un JSON vacío para extraer los binds y falla antes de llegar al
  // paquete PL/SQL.
  const tieneBody = init?.body != null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(tieneBody ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }

  // ORDS a veces responde texto plano en los errores: parsear defensivamente.
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (res.status === 401 || res.status === 403) {
    // Si el handler todavía no está registrado, limpiar igual la sesión: sin
    // esto el usuario queda con un token muerto en localStorage y la app no
    // vuelve al login.
    if (onUnauthorized) onUnauthorized();
    else clearStoredSession();
    throw new SesionExpiradaError();
  }

  // ORDS puede devolver 200 con {success:false}: también es error.
  const failed =
    data && typeof data === "object" && (data as { success?: boolean }).success === false;

  if (!res.ok || failed) {
    // Los paquetes PL/SQL devuelven { success:false, message:"..." }.
    const msg =
      (data &&
        typeof data === "object" &&
        ((data as { message?: string }).message ?? (data as { error?: string }).error)) ||
      (typeof data === "string" && data) ||
      `Error ${res.status}`;
    throw new Error(String(msg));
  }

  return data as T;
}
