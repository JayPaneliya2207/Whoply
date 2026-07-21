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
    themeColor: '#4338CA',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
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
