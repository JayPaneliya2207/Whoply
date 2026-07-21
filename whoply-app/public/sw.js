/* Whoply service worker — minimal offline app-shell cache.
   Network-first for navigations (fresh data when online), falling back to cache offline. */
const CACHE = 'whoply-v1';
const SHELL = ['/', '/dashboard', '/billing', '/login'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return; // never cache POST (sales etc.)
    if (req.url.includes('/api/')) return; // let API calls hit the network
    e.respondWith(
        fetch(req)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(req).then((m) => m || caches.match('/')))
    );
});
