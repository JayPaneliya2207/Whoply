import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { PWARegister } from '@/components/PWARegister';

export const metadata: Metadata = {
    title: 'Whoply — Run your shop & wholesale business',
    description: 'Inventory, GST billing, udhar, orders & insights for shopkeepers and wholesalers.',
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Whoply', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
    themeColor: '#0F2B46',
    width: 'device-width',
    initialScale: 1,
    // No maximumScale: people must be able to pinch-zoom (WCAG 1.4.4). Inputs use
    // 16px text on phones so iOS doesn't zoom in on focus (globals.css).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <PWARegister />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
