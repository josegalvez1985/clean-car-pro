// Acceso biométrico local (WebAuthn) + credenciales recordadas.
//
// Estrategia: cuando el usuario marca "recordar", guardamos usuario y
// contraseña en localStorage y registramos una credencial WebAuthn de
// plataforma (huella / Face ID / Windows Hello). En reingresos, pedimos el
// gesto biométrico; si el navegador lo verifica, devolvemos las credenciales
// guardadas para hacer login automático.
//
// Nota: la verificación biométrica ocurre en el dispositivo. El objetivo es
// desbloquear credenciales locales, no autenticar contra el servidor.

const CREDS_KEY = "cleancar.creds";
const CRED_ID_KEY = "cleancar.webauthn.id";

export interface RememberedCreds {
  username: string;
  password: string;
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

export function hasRememberedCreds(): boolean {
  return !!localStorage.getItem(CREDS_KEY);
}

export function getRememberedUsername(): string | null {
  const raw = localStorage.getItem(CREDS_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as RememberedCreds).username ?? null;
  } catch {
    return null;
  }
}

export function saveCreds(creds: RememberedCreds) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function clearCreds() {
  localStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(CRED_ID_KEY);
}

export function biometricAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    "credentials" in navigator
  );
}

export function biometricEnabled(): boolean {
  return biometricAvailable() && !!localStorage.getItem(CRED_ID_KEY);
}

/** Registra una credencial WebAuthn de plataforma. Devuelve true si quedó lista. */
export async function registerBiometric(username: string): Promise<boolean> {
  if (!biometricAvailable()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Clean Car", id: window.location.hostname },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) return false;
    localStorage.setItem(CRED_ID_KEY, toB64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pide el gesto biométrico. Si el navegador verifica al usuario, devuelve las
 * credenciales recordadas para el login automático; si falla, devuelve null.
 */
export async function unlockWithBiometric(): Promise<RememberedCreds | null> {
  if (!biometricEnabled()) return null;
  const credIdB64 = localStorage.getItem(CRED_ID_KEY);
  const rawCreds = localStorage.getItem(CREDS_KEY);
  if (!credIdB64 || !rawCreds) return null;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { type: "public-key", id: fromB64(credIdB64) },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    if (!assertion) return null;
    return JSON.parse(rawCreds) as RememberedCreds;
  } catch {
    return null;
  }
}
