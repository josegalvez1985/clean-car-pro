import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se reporta como Mac con touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// `beforeinstallprompt` se dispara una sola vez, poco después de cargar la
// página. Si el listener viviera en el efecto del componente, cualquier
// pantalla montada por navegación de cliente (p. ej. entrar a /cuenta desde el
// home) llegaría tarde: el evento ya pasó y el botón queda deshabilitado con
// "No disponible en este navegador". Por eso se captura a nivel de módulo, al
// importar la app, y los componentes se suscriben al valor ya guardado.
let promptGuardado: BeforeInstallPromptEvent | null = null;
const suscriptores = new Set<(e: BeforeInstallPromptEvent | null) => void>();

function emitir(e: BeforeInstallPromptEvent | null) {
  promptGuardado = e;
  for (const fn of suscriptores) fn(e);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    emitir(e as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => emitir(null));
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(promptGuardado);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    // Registrar el service worker (requisito para que el navegador ofrezca instalar).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
        /* sin SW no hay instalación automática, pero no rompe la app */
      });
    }

    // Tomar el prompt que se haya capturado antes de montar este componente.
    setDeferred(promptGuardado);

    const onCambio = (e: BeforeInstallPromptEvent | null) => {
      setDeferred(e);
      if (e === null) {
        setInstalled(isStandalone());
        setIosHint(false);
      }
    };
    suscriptores.add(onCambio);
    return () => {
      suscriptores.delete(onCambio);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      // El prompt es de un solo uso: el navegador emite otro si sigue siendo
      // instalable, así que se descarta el consumido.
      emitir(null);
      return;
    }
    // iOS no expone la API: mostramos instrucciones manuales.
    if (isIOS()) setIosHint(true);
  };

  // Mostrar el botón si: no está instalada Y (hay prompt disponible o es iOS).
  const canInstall = !installed && (deferred !== null || isIOS());

  return { canInstall, installed, install, iosHint, dismissIosHint: () => setIosHint(false) };
}
