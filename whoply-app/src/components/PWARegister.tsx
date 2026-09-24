'use client';
import { useEffect } from 'react';

/**
 * Registers the service worker so Whoply is installable & works offline.
 *
 * Production only: in dev the SW would cache hot-reloaded chunks and serve
 * stale ones after every change. Any worker left over from an earlier dev
 * session is removed along with its caches.
 */
export function PWARegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        if (process.env.NODE_ENV !== 'production') {
            navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
            if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
            return;
        }
        navigator.serviceWorker.register('/sw.js').catch(() => { /* SW is optional */ });
    }, []);
    return null;
}
