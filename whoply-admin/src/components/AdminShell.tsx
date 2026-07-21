'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, Building2, Users, LogOut, Moon, Sun, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';

const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/businesses', label: 'Businesses', icon: Building2 },
    { href: '/users', label: 'Users', icon: Users },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();

    const doLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* */ }
        logout(); router.replace('/login');
    };

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
            <aside className="w-[240px] shrink-0 hidden lg:flex flex-col h-screen sticky top-0" style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}>
                <div className="p-5"><Logo size={28} /></div>
                <div className="px-3 mb-2">
                    <div className="wp-chip w-fit" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}><ShieldCheck size={13} /> Platform Admin</div>
                </div>
                <nav className="flex-1 px-3 py-2 space-y-1">
                    {nav.map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                                style={active ? { background: 'var(--brand-700)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
                                <Icon size={18} /> {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                    <button onClick={doLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full" style={{ color: 'var(--danger-500)' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </aside>
            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 flex items-center justify-between px-5 sticky top-0 z-20" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <div className="lg:hidden"><Logo size={26} /></div>
                    <p className="hidden lg:block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Whoply Platform Console</p>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="wp-btn wp-btn-ghost !px-2.5">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
                        <div className="h-9 w-9 grid place-items-center rounded-full font-bold text-sm" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{user?.name?.charAt(0) || 'A'}</div>
                    </div>
                </header>
                <main className="flex-1 p-5 max-w-[1300px] w-full mx-auto">{children}</main>
            </div>
        </div>
    );
}
