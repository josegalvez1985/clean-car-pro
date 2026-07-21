// Service worker mínimo para habilitar la instalación de la PWA.
// (Chrome/Edge exigen un SW con handler `fetch` para disparar beforeinstallprompt.)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Solo se interviene el propio origen. Interceptar las llamadas a ORDS no
  // aporta nada (no hay caché offline) y encima disfraza los errores: un 403
  // de CORS llegaba al cliente como un "Failed to fetch" genérico, sin el
  // mensaje real del backend.
  if (url.origin !== self.location.origin) return;

  // Sin respondWith el navegador maneja la request como si no hubiera SW. Con
  // respondWith + fetch pelado, cualquier fallo de red rechaza la promesa y se
  // convierte en un ERR_FAILED que rompe hasta la carga de la página.
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
