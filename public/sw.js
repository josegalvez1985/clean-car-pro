// Service worker mínimo para habilitar la instalación de la PWA.
// (Chrome/Edge exigen un SW con handler `fetch` para disparar beforeinstallprompt.)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Passthrough a la red. Sin caché offline por ahora.
  event.respondWith(fetch(event.request));
});
