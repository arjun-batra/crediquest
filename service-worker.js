const CACHE_NAME = 'crediquest-alpha-0.1-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/multiplier_data.json',
    '/app.js',
    '/credit.png',
    '/styles.css'
];

// Install event - Cache necessary resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Activate event - Cleanup old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - Network first, then cache if not available
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Only cache the response if it's a valid request (to avoid caching non-cacheable content like images or POST requests)
                if (event.request.url.includes('http')) {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                }
                return response;
            })
            .catch(() => {
                // If network fails, fallback to cache
                return caches.match(event.request);
            })
    );
});
