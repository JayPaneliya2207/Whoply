'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useLang } from '@/i18n';

export default function Home() {
    const router = useRouter();
    const hydrateLang = useLang((s) => s.hydrate);
    useEffect(() => {
        hydrateLang();
        const token = localStorage.getItem('whoply_token');
        router.replace(token ? '/dashboard' : '/login');
    }, [router, hydrateLang]);
    return (
        <div className="min-h-screen wp-gradient grid place-items-center">
            <div className="wp-fade-up"><Logo size={44} /></div>
        </div>
    );
}
