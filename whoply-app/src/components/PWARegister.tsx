'use client';
import { useEffect } from 'react';

/** Registers the service worker so Whoply is installable & works offline. */
export function PWARegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { /* SW optional in dev */ });
        }
    }, []);
    return null;
}
