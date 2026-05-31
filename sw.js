const CACHE_NAME = "controle-financeiro-v4";
const STATIC_CACHE = "controle-financeiro-static-v4";
const DYNAMIC_CACHE = "controle-financeiro-dynamic-v4";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./auth.js",
  "./family-setup.js",
  "./family-setup.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./modules/card.js",
  "./modules/dashboard.js",
  "./modules/expenses.js",
  "./modules/incomes.js",
  "./utils/currency.js",
  "./utils/dates.js",
  "./store/state.js",
  "./error-tracking.js",
  "./analytics.js"
];

const CACHE_STRATEGIES = {
  // Cache first, fall back to network - for static assets
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  },
  
  // Network first, fall back to cache - for dynamic content
  networkFirst: async (request) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  },
  
  // Stale while revalidate - for frequently updated content
  staleWhileRevalidate: (request) => {
    return caches.match(request).then((cached) => {
      const networkPromise = fetch(request).then((response) => {
        // Clone response before reading body
        const responseClone = response.clone();
        
        if (response.ok) {
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
      
      return cached || networkPromise;
    });
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key))
        )
      ),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) return;
  
  // Strategy selection based on request type
  let strategy;
  
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    strategy = CACHE_STRATEGIES.cacheFirst;
  } else if (url.pathname.includes('supabase') || url.pathname.includes('api')) {
    // Don't cache API calls
    return;
  } else {
    strategy = CACHE_STRATEGIES.staleWhileRevalidate;
  }
  
  event.respondWith(strategy(event.request));
});

// Periodic cache cleanup (every 24 hours)
self.addEventListener('message', (event) => {
  if (event.data === 'cleanup') {
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.keys().then((requests) => {
        requests.forEach((request) => {
          // Remove items older than 24 hours
          caches.match(request).then((response) => {
            if (response) {
              const date = response.headers.get('date');
              if (date) {
                const cacheAge = (new Date() - new Date(date)) / 1000 / 60 / 60; // hours
                if (cacheAge > 24) {
                  cache.delete(request);
                }
              }
            }
          });
        });
      });
    });
  }
});
