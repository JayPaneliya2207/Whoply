import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Whoply — Business Manager',
        short_name: 'Whoply',
        description: 'Inventory, GST billing, udhar & insights for shopkeepers and wholesalers.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F8F9FB',
        theme_color: '#0F2B46',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // Full navy square with the mark in the safe zone — Android cuts its own shape.
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            { name: 'New Bill', url: '/billing' },
            { name: 'Udhar', url: '/customers' },
        ],
    };
}
