import type { Metadata } from 'next';
import { Landing } from '@/components/landing/Landing';
import { getCopy } from '@/i18n/landing';

const t = getCopy('en');

export const metadata: Metadata = {
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
        canonical: '/',
        languages: { 'en-IN': '/', 'hi-IN': '/hi', 'gu-IN': '/gu' },
    },
    openGraph: { url: '/', title: t.meta.ogTitle, description: t.meta.ogDescription, locale: 'en_IN' },
    twitter: { title: t.meta.ogTitle, description: t.meta.ogDescription },
};

export default function Page() {
    return <Landing lang="en" />;
}
