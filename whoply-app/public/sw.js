/* Whoply service worker — minimal offline app-shell cache, and phone notifications.
   Network-first for navigations (fresh data when online), falling back to cache offline. */
const CACHE = 'whoply-v3'; // bump to purge caches written by older versions
const SHELL = ['/', '/dashboard', '/billing', '/login'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});

/* ── Phone notifications ──────────────────────────────────────────────
   The API pushes { title, body, url, tag } (whoply-api services/push.service.ts).
   It is shown by the phone itself, with its own notification sound, even when
   Whoply is closed. A newer one with the same tag replaces the older. */
self.addEventListener('push', (e) => {
    let data = {};
    try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
    e.waitUntil(
        Promise.all([
            self.registration.showNotification(data.title || 'Whoply', {
                body: data.body || '',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.tag || 'whoply',
                renotify: true, // ring and buzz again when it replaces an older one
                vibrate: [120, 60, 120],
                data: { url: data.url || '/notifications' },
            }),
            // An open app refreshes its bell at once instead of waiting for the next check.
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: 'whoply-push' }))),
        ])
    );
});

/* A tap opens Whoply on the right screen: the window that is already open, or a new one. */
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = new URL((e.notification.data && e.notification.data.url) || '/notifications', self.location.origin).href;
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            const open = list.find((c) => new URL(c.url).origin === self.location.origin);
            if (!open) return self.clients.openWindow(url);
            return ('navigate' in open ? open.navigate(url).catch(() => null) : Promise.resolve(null)).then(() => open.focus());
        })
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
