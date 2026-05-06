// IMPORTANT: bump SW_VERSION whenever you bump APP_VERSION in script.js.
// The two strings must stay in sync — there is no shared constant because
// sw.js runs in a separate JS context from script.js (no importScripts here).
const SW_VERSION = "20260506.4";
const CACHE_NAME = `fcc-cache-${SW_VERSION}`;

// Use absolute paths tied specifically to your GH Pages repository
const ASSETS = [
  '/fire-buckets/',
  '/fire-buckets/index.html',
  '/fire-buckets/script.js',
  '/fire-buckets/manifest.json',
  '/fire-buckets/icon-192.png',
  '/fire-buckets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stale-while-revalidate: serve cached copy instantly, refresh in background.
// On the next page load the user gets the updated asset. For navigations
// without network, fall back to cached index.html.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => null);

      if (cached) {
        // Kick off refresh, but return cached immediately.
        event.waitUntil(networkFetch);
        return cached;
      }

      // No cache hit — wait for network, with offline fallback for navigations.
      return networkFetch.then((response) => {
        if (response) return response;
        if (event.request.mode === 'navigate') {
          return caches.match('/fire-buckets/index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});