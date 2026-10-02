'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { Moon, Sun, ArrowLeft, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/stores/auth.store';
import { NotificationBell } from '@/components/NotificationBell';
import { OfflineBadge } from '@/components/OfflineBadge';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BottomNav } from '@/components/BottomNav';
import { useLang, useT } from '@/i18n';
import { canOpen } from '@/lib/permissions';

/**
 * App shell — sidebar-less, mobile-app style. The dashboard is the home screen
 * (a grid of app icons, see NavGrid); every other page opens full-width with a
 * back arrow + the Whoply logo (tap → home) in a sticky top bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const hydrateLang = useLang((s) => s.hydrate);
    useEffect(() => { hydrateLang(); }, [hydrateLang]);

    const isDash = pathname === '/dashboard';
    // A staff role that can't use this screen (typed URL, old link) gets a short note instead.
    const allowed = !user || canOpen(user.role, pathname);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
            <header
                className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6 gap-2"
                style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {!isDash && (
                        <button onClick={() => router.back()} aria-label="Back" className="h-9 w-9 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <Link href="/dashboard" aria-label="Home"><Logo size={26} /></Link>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <OfflineBadge />
                    <LanguageSelector compact />
                    <NotificationBell />
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="wp-btn wp-btn-ghost !px-2.5"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{allowed ? children : <NoAccess />}</main>
            <BottomNav />
        </div>
    );
}

function NoAccess() {
    const t = useT();
    return (
        <div className="wp-card p-8 max-w-md mx-auto mt-8 text-center">
            <div className="h-12 w-12 mx-auto grid place-items-center rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}><Lock size={22} /></div>
            <h1 className="text-lg font-bold mt-4" style={{ color: 'var(--text-primary)' }}>{t('noAccessTitle')}</h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>{t('noAccessBody')}</p>
            <Link href="/dashboard" className="wp-btn wp-btn-primary mt-5 inline-flex">{t('goHome')}</Link>
        </div>
    );
}
