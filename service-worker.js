const CACHE_NAME = 'crediquest-alpha-0.1-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/multiplier_data.json',
    '/app.js',
    '/image/icon2.png',
    '/styles.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the request is successful, clone it and store it in the cache
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
        return response;
      })
      .catch(() => {
        // If the network request fails, serve the cached resource instead
        return caches.match(event.request);
      })
  );
});