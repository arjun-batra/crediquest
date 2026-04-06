// ── Transition service worker ────────────────────────────────────────────────
// This file exists solely to rescue users whose PWA is stuck on an old cached
// version. Background:
//
//   The original install cached everything under /crediquest/ and registered
//   the SW via a relative path, so update checks go to /crediquest/service-worker.js.
//   That path returned 404 on the custom domain, so the old SW stayed forever.
//
// What this SW does:
//   1. Clears every cache (removes all stale /crediquest/ cached files)
//   2. Takes control immediately via skipWaiting + clients.claim
//   3. Redirects every open PWA window to / (the correct root)
//   4. At /, the new app.js registers /service-worker.js correctly
//   5. This file can be removed once all legacy installs have migrated

self.addEventListener('install', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        self.clients.claim()
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => Promise.all(clients.map(client => client.navigate('/'))))
    );
});
