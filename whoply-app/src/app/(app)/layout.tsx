'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, homeFor, storedUser } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Logo } from '@/components/Logo';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { hydrate, setUser } = useAuth();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        hydrate();
        const token = localStorage.getItem('whoply_token');
        if (!token) {
            router.replace('/login');
            return;
        }
        // A login whose business isn't set up yet belongs on the setup screen —
        // every shop screen would only fail with "complete onboarding".
        const saved = storedUser();
        if (saved && homeFor(saved) === '/onboarding') {
            router.replace('/onboarding');
            return;
        }
        if (saved) setReady(true);
        // Refresh the saved user in the background: role, shop and setup can change
        // on another device (the owner changes a role, a new shop is set up).
        let alive = true;
        api.get('/auth/me')
            .then(({ data }) => {
                if (!alive) return;
                const fresh = data.data.user;
                setUser(fresh);
                if (homeFor(fresh) === '/onboarding') router.replace('/onboarding');
                else setReady(true);
            })
            .catch(() => {
                // Offline or server down: keep using the saved user. (A 401 logs out in lib/api.)
                if (alive && saved) setReady(true);
            });
        return () => { alive = false; };
    }, [hydrate, router, setUser]);

    if (!ready) {
        return (
            <div className="min-h-screen wp-gradient grid place-items-center">
                <div className="wp-fade-up"><Logo size={40} /></div>
            </div>
        );
    }
    return <AppShell>{children}</AppShell>;
}
