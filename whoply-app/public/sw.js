/* Whoply service worker — minimal offline app-shell cache.
   Network-first for navigations (fresh data when online), falling back to cache offline. */
const CACHE = 'whoply-v2'; // bump to purge caches written by older versions
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
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // API, fonts, CDNs: straight to network
    if (url.pathname.startsWith('/api/')) return;
    e.respondWith(
        fetch(req)
            .then((res) => {
                // Only keep good responses — caching a 404/500 would replay it offline.
                if (res.ok && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(async () => {
                const hit = await caches.match(req);
                if (hit) return hit;
                // The app shell is only a valid stand-in for a page. Handing HTML to a
                // script or chunk request is what breaks the app with "Unexpected token '<'".
                if (req.mode === 'navigate') return (await caches.match('/')) || Response.error();
                return Response.error();
            })
    );
});
