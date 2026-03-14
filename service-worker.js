const CACHE_NAME = 'crediquest-alpha-0.4.1';
const urlsToCache = [
    '/crediquest/',
    'index.html',
    '/crediquest/styles.css',
    '/crediquest/app.js',
    '/crediquest/icons/icon-192x192.png',
    '/crediquest/icons/icon-500x500.png'  // FIX: was icon-512x512.png — must match manifest.json
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        )
    );
});
