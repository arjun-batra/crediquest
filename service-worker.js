const CACHE = 'crediquest-v0.5';
const PRECACHE = [
    '/crediquest/',
    '/crediquest/index.html',
    '/crediquest/styles.css',
    '/crediquest/app.js',
    '/crediquest/icons/icon-192x192.png',
    '/crediquest/icons/icon-500x500.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Network-first for API calls, cache-first for assets
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Always go to network for Supabase
    if (url.hostname.includes('supabase.co')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Cache-first for everything else
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
