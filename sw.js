// Kill-switch service worker.
// The legacy app registered a service worker that aggressively cached
// static assets. This stub replaces it: it unregisters itself and
// clears all caches, so the new Vite/Vue app is served fresh.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (_) {
      // no-op
    }
  })());
});
