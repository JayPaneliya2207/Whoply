import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Whoply — Business Manager',
        short_name: 'Whoply',
        description: 'Inventory, GST billing, udhar & insights for shopkeepers and wholesalers.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#4338CA',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            { name: 'New Bill', url: '/billing' },
            { name: 'Udhar', url: '/customers' },
        ],
    };
}
