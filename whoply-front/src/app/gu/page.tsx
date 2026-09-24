import type { Metadata } from 'next';
import { Landing } from '@/components/landing/Landing';
import { getCopy } from '@/i18n/landing';

const t = getCopy('gu');

export const metadata: Metadata = {
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
        canonical: '/gu',
        languages: { 'en-IN': '/', 'hi-IN': '/hi', 'gu-IN': '/gu' },
    },
    openGraph: { url: '/gu', title: t.meta.ogTitle, description: t.meta.ogDescription, locale: 'gu_IN' },
    twitter: { title: t.meta.ogTitle, description: t.meta.ogDescription },
};

export default function Page() {
    return <Landing lang="gu" />;
}
