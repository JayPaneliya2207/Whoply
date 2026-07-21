import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Whoply — Billing, Inventory & Udhar for Shops & Wholesalers',
    description:
        'Whoply is the all-in-one business app for Indian shopkeepers and wholesalers — GST billing, smart inventory, udhar reminders, orders, dispatch and insights.',
    keywords: ['GST billing app', 'kirana software', 'wholesale management', 'udhar app', 'inventory app India'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
