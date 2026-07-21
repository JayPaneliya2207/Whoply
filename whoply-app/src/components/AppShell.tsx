'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import {
    LayoutDashboard, ShoppingCart, Package, Users, FileText, Truck, Wallet,
    BarChart3, LogOut, Menu, X, Moon, Sun, Store, Building2, Tags, Route, Sparkles, Settings, ArrowLeft, UsersRound,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/components/NotificationBell';
import { OfflineBadge } from '@/components/OfflineBadge';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLang, useT } from '@/i18n';

const retailNav = [
    { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
    { href: '/billing', key: 'billing', icon: ShoppingCart },
    { href: '/products', key: 'products', icon: Package },
    { href: '/customers', key: 'customersUdhar', icon: Users },
    { href: '/purchases', key: 'suppliers', icon: Truck },
    { href: '/expenses', key: 'expenses', icon: Wallet },
    { href: '/staff', key: 'staff', icon: UsersRound },
    { href: '/insights', key: 'aiInsights', icon: Sparkles },
    { href: '/reports', key: 'reports', icon: BarChart3 },
    { href: '/settings', key: 'settings', icon: Settings },
];
const wholesaleNav = [
    { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
    { href: '/dealers', key: 'dealers', icon: Users },
    { href: '/orders', key: 'orders', icon: FileText },
    { href: '/dispatch', key: 'dispatch', icon: Truck },
    { href: '/price-lists', key: 'priceLists', icon: Tags },
    { href: '/sales-team', key: 'salesTeam', icon: Route },
    { href: '/products', key: 'warehouse', icon: Package },
    { href: '/staff', key: 'staff', icon: UsersRound },
    { href: '/settings', key: 'settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const t = useT();
    const hydrateLang = useLang((s) => s.hydrate);
    useEffect(() => { hydrateLang(); }, [hydrateLang]);

    const nav = user?.business?.type === 'wholesale' ? wholesaleNav : retailNav;

    const doLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        logout();
        router.replace('/login');
    };

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed lg:static z-40 h-screen w-[260px] shrink-0 flex flex-col transition-transform lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
                style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}
            >
                <div className="p-5 flex items-center justify-between">
                    <Logo size={30} />
                    <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
                </div>

                <div className="px-3 mb-2">
                    <div className="wp-card p-3 flex items-center gap-2.5" style={{ background: 'var(--surface-2)' }}>
                        <div className="grid place-items-center h-9 w-9 rounded-lg" style={{ background: 'var(--brand-700)', color: '#fff' }}>
                            {user?.business?.type === 'wholesale' ? <Building2 size={18} /> : <Store size={18} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.business?.name || 'My Business'}</p>
                            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{user?.business?.type} · {user?.business?.plan}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto wp-scroll">
                    {nav.map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                                style={
                                    active
                                        ? { background: 'var(--brand-700)', color: '#fff', boxShadow: 'var(--shadow-sm)' }
                                        : { color: 'var(--text-secondary)' }
                                }
                            >
                                <Icon size={18} /> {t(item.key)}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                    <button onClick={doLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full" style={{ color: 'var(--danger-500)' }}>
                        <LogOut size={18} /> {t('logout')}
                    </button>
                </div>
            </aside>

            {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col">
                <header
                    className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6"
                    style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}
                >
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></button>
                        {pathname !== '/dashboard' && (
                            <button onClick={() => router.back()} aria-label="Back" className="h-9 w-9 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hi')}, {user?.name?.split(' ')[0] || 'there'} 👋</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <OfflineBadge />
                        <div className="hidden sm:block"><LanguageSelector compact /></div>
                        <NotificationBell />
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="wp-btn wp-btn-ghost !px-2.5"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="h-9 w-9 grid place-items-center rounded-full font-bold text-sm" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>
                            {user?.name?.charAt(0) || 'W'}
                        </div>
                    </div>
                </header>
                <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
            </div>
        </div>
    );
}
