'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, Building2, Users, LogOut, Moon, Sun, ShieldCheck, CreditCard, Menu, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/businesses', label: 'Businesses', icon: Building2 },
    { href: '/plans', label: 'Subscriptions', icon: CreditCard },
    { href: '/users', label: 'Users', icon: Users },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const doLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* */ }
        logout(); router.replace('/login');
    };

    const width = collapsed ? 'w-[74px]' : 'w-[240px]';

    const renderSidebar = (mini: boolean) => (
        <>
            <div className={cn('flex items-center gap-2 p-5', mini && 'justify-center p-4')}>
                <Logo size={28} showText={!mini} />
            </div>
            {!mini && (
                <div className="px-3 mb-2">
                    <div className="wp-chip w-fit" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}><ShieldCheck size={13} /> Platform Admin</div>
                </div>
            )}
            <nav className="flex-1 px-3 py-2 space-y-1">
                {nav.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={item.label}
                            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium', mini && 'justify-center')}
                            style={active ? { background: 'var(--brand-700)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
                            <Icon size={18} /> {!mini && item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <button onClick={doLogout} title="Logout" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full', mini && 'justify-center')} style={{ color: 'var(--danger-500)' }}>
                    <LogOut size={18} /> {!mini && 'Logout'}
                </button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
            {/* desktop sidebar (collapsible) */}
            <aside className={cn('shrink-0 hidden lg:flex flex-col h-screen sticky top-0 transition-[width] duration-200', width)} style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}>
                {renderSidebar(collapsed)}
            </aside>

            {/* mobile drawer (always full labels) */}
            {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
            <aside className={cn('fixed z-50 h-screen w-[240px] flex flex-col lg:hidden transition-transform', mobileOpen ? 'translate-x-0' : '-translate-x-full')} style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}>
                <div className="flex justify-end p-3"><button onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
                {renderSidebar(false)}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 flex items-center justify-between px-4 sm:px-5 sticky top-0 z-20" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-2">
                        <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
                        {/* desktop collapse toggle */}
                        <button className="hidden lg:grid place-items-center h-9 w-9 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Expand' : 'Collapse'}>
                            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                        </button>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Whoply Platform Console</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="wp-btn wp-btn-ghost !px-2.5">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
                        <div className="h-9 w-9 grid place-items-center rounded-full font-bold text-sm" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{user?.name?.charAt(0) || 'A'}</div>
                    </div>
                </header>
                <main className="flex-1 p-4 sm:p-5 max-w-[1300px] w-full mx-auto">{children}</main>
            </div>
        </div>
    );
}
