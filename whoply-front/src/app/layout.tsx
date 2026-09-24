import type { Metadata, Viewport } from 'next';
import { Inter, Kalam, Manrope, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from 'next/font/google';
import './globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const manrope = Manrope({
    subsets: ['latin'],
    weight: ['600', '700', '800'],
    variable: '--font-manrope',
    display: 'swap',
});

/**
 * Inter and Manrope carry no Devanagari or Gujarati glyphs, so the /hi and /gu
 * pages would fall back to whatever the device happens to have. These sit at the
 * end of the font stack and — with `preload: false` — are only fetched by
 * browsers that actually need to render those scripts, so the English page
 * pays nothing for them.
 */
const devanagari = Noto_Sans_Devanagari({
    subsets: ['devanagari'],
    weight: ['400', '600', '700', '800'],
    variable: '--font-devanagari',
    display: 'swap',
    preload: false,
});

const gujarati = Noto_Sans_Gujarati({
    subsets: ['gujarati'],
    weight: ['400', '600', '700', '800'],
    variable: '--font-gujarati',
    display: 'swap',
    preload: false,
});

/** Handwriting for the paper-register side of the comparison (Latin + Devanagari). */
const hand = Kalam({
    subsets: ['latin', 'devanagari'],
    weight: ['400', '700'],
    variable: '--font-kalam',
    display: 'swap',
    preload: false,
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://whoply.in';

/**
 * Per-locale title/description/canonical/OG live on each page
 * (`/`, `/hi`, `/gu`). Only site-wide defaults belong here.
 */
export const metadata: Metadata = {
    metadataBase: new URL(SITE),
    title: 'Whoply',
    openGraph: { type: 'website', siteName: 'Whoply' },
    twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
    themeColor: '#0F2B46',
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // NOTE: the root layout is shared across locales, so `lang` here is the
    // default. Each locale re-declares it on its own wrapper in Landing.tsx.
    // Moving the routes under `app/[lang]/` would let this be exact.
    return (
        <html
            lang="en"
            className={`${inter.variable} ${manrope.variable} ${devanagari.variable} ${gujarati.variable} ${hand.variable}`}
        >
            <body>{children}</body>
        </html>
    );
}
