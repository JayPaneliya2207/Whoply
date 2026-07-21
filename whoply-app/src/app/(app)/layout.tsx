'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth.store';
import { AppShell } from '@/components/AppShell';
import { Logo } from '@/components/Logo';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { hydrate } = useAuth();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        hydrate();
        const token = localStorage.getItem('whoply_token');
        if (!token) {
            router.replace('/login');
            return;
        }
        setReady(true);
    }, [hydrate, router]);

    if (!ready) {
        return (
            <div className="min-h-screen wp-gradient grid place-items-center">
                <div className="wp-fade-up"><Logo size={40} /></div>
            </div>
        );
    }
    return <AppShell>{children}</AppShell>;
}
