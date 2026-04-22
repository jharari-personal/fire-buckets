const CACHE_NAME = 'fcc-cache-v5';

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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 1. Return cached asset if found
      if (response) return response;
      
      // 2. Fetch from network if not in cache
      return fetch(event.request).catch(() => {
        // 3. Fallback if network fails and user is navigating
        if (event.request.mode === 'navigate') {
          return caches.match('/fire-buckets/index.html');
        }
      });
    })
  );
});