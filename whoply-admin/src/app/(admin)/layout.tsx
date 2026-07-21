'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth.store';
import { AdminShell } from '@/components/AdminShell';
import { Logo } from '@/components/Logo';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { hydrate } = useAuth();
    const [ready, setReady] = useState(false);
    useEffect(() => {
        hydrate();
        if (!localStorage.getItem('whoply_admin_token')) { router.replace('/login'); return; }
        setReady(true);
    }, [hydrate, router]);
    if (!ready) return <div className="min-h-screen wp-gradient grid place-items-center"><Logo size={40} /></div>;
    return <AdminShell>{children}</AdminShell>;
}
