'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Building2, Users, LogOut, Moon, Sun, ShieldCheck, CreditCard, Menu, X, PanelLeftClose, PanelLeft, CalendarDays, ChevronDown, Receipt, Settings, MessagesSquare } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface NavItem { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; blurb: string }

/** Sidebar sections. The header shows the open page's label and blurb. */
const NAV: { title: string; items: NavItem[] }[] = [
    { title: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, blurb: 'The whole platform at a glance' }] },
    {
        title: 'Manage', items: [
            { href: '/businesses', label: 'Businesses', icon: Building2, blurb: 'Shops and wholesalers on Whoply' },
            { href: '/users', label: 'Users', icon: Users, blurb: 'Every login, across all businesses' },
            { href: '/plans', label: 'Subscriptions', icon: CreditCard, blurb: 'Plans, prices and who is on them' },
            { href: '/billing', label: 'Billing', icon: Receipt, blurb: 'Subscription bills, reminders and payments' },
            { href: '/support', label: 'Support', icon: MessagesSquare, blurb: 'Chat with business owners' },
        ],
    },
    { title: 'Platform', items: [{ href: '/settings', label: 'Settings', icon: Settings, blurb: 'Company, payment details, reminders, support' }] },
];
const PAGES = NAV.flatMap((g) => g.items);

/**
 * Admin console frame: a collapsible sidebar (drawer on phones) with grouped
 * links and the signed-in admin at the bottom; a header with the page title,
 * today's date, theme switch and an account menu.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [menu, setMenu] = useState(false);
    const [mounted, setMounted] = useState(false); // the theme icon is only right after mount
    useEffect(() => setMounted(true), []);
    useEffect(() => { setMobileOpen(false); setMenu(false); }, [pathname]);

    // Unread support messages, for the badge on the Support link.
    const { data: support } = useQuery({ queryKey: ['support-summary'], queryFn: async () => (await api.get('/admin/support/summary')).data.data, refetchInterval: 20_000 });
    const badges: Record<string, number> = { '/support': support?.unread || 0 };

    const page = PAGES.find((p) => pathname === p.href || pathname.startsWith(p.href + '/')) || PAGES[0];
    const initial = user?.name?.charAt(0)?.toUpperCase() || 'A';
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    const doLogout = async () => {
        try { await api.post('/auth/logout'); } catch { /* signing out anyway */ }
        logout(); router.replace('/login');
    };

    const renderSidebar = (mini: boolean) => (
        <>
            <div className={cn('flex items-center gap-2.5 px-5 pt-5 pb-4', mini && 'justify-center px-0')}>
                <Logo size={30} showText={!mini} />
            </div>
            {!mini && (
                <div className="px-5 pb-3">
                    <span className="wp-chip" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><ShieldCheck size={13} /> Platform console</span>
                </div>
            )}
            <nav className="flex-1 px-3 py-2 space-y-5 overflow-y-auto wp-scroll">
                {NAV.map((group) => (
                    <div key={group.title}>
                        {!mini && <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.title}</p>}
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const active = item.href === page.href;
                                const Icon = item.icon;
                                return (
                                    <Link key={item.href} href={item.href} title={item.label}
                                        className={cn('adm-nav flex items-center gap-3 rounded-xl text-sm font-semibold transition-colors', mini ? 'justify-center h-11 w-11 mx-auto' : 'px-3 py-2.5', active && 'is-active')}
                                        style={active ? { background: 'var(--brand)', color: '#fff', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                                        <span className="relative shrink-0">
                                            <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                                            {mini && badges[item.href] > 0 && <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                                        </span>
                                        {!mini && <span className="flex-1">{item.label}</span>}
                                        {!mini && badges[item.href] > 0 && <span className="h-5 min-w-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>{badges[item.href]}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
            <div className="p-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <div className={cn('flex items-center gap-3 rounded-xl p-2', mini && 'flex-col gap-2')}>
                    <div className="h-9 w-9 shrink-0 grid place-items-center rounded-full font-bold text-sm" style={{ background: 'var(--brand)', color: '#fff' }}>{initial}</div>
                    {!mini && (
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Admin'}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>Platform admin</p>
                        </div>
                    )}
                    <button onClick={doLogout} title="Sign out" aria-label="Sign out" className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ color: 'var(--danger)', background: 'var(--danger-tint)' }}><LogOut size={16} /></button>
                </div>
            </div>
        </>
    );

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
            {/* desktop sidebar (collapsible) */}
            <aside className={cn('shrink-0 hidden lg:flex flex-col h-screen sticky top-0 transition-[width] duration-200', collapsed ? 'w-[76px]' : 'w-[252px]')} style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}>
                {renderSidebar(collapsed)}
            </aside>

            {/* phone drawer (always full labels) */}
            {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
            <aside className={cn('fixed z-50 h-screen w-[260px] flex flex-col lg:hidden transition-transform', mobileOpen ? 'translate-x-0' : '-translate-x-full')} style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--card-border)' }}>
                <div className="flex justify-end p-3 pb-0"><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} style={{ color: 'var(--text-muted)' }} /></button></div>
                {renderSidebar(false)}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 sticky top-0 z-20" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button className="lg:hidden h-9 w-9 grid place-items-center rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu size={20} /></button>
                        <button className="hidden lg:grid place-items-center h-9 w-9 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
                            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                        </button>
                        <div className="min-w-0">
                            <p className="text-base font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{page.label}</p>
                            <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{page.blurb}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}><CalendarDays size={14} /> {today}</span>
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="wp-btn wp-btn-ghost !px-2.5" aria-label="Toggle theme">
                            {mounted && theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="relative">
                            <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1" style={{ background: 'var(--surface-2)' }} aria-haspopup="menu" aria-expanded={menu}>
                                <span className="h-8 w-8 grid place-items-center rounded-full font-bold text-sm" style={{ background: 'var(--brand)', color: '#fff' }}>{initial}</span>
                                <span className="hidden sm:block text-sm font-semibold max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>{user?.name?.split(' ')[0] || 'Admin'}</span>
                                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                            </button>
                            {menu && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-60 wp-card p-1.5 z-40" style={{ boxShadow: 'var(--shadow-lg)' }}>
                                        <div className="px-3 py-2">
                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.mobile} · Platform admin</p>
                                        </div>
                                        <button onClick={doLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--danger)' }}><LogOut size={16} /> Sign out</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>
                <main className="flex-1 p-4 sm:p-6 max-w-[1320px] w-full mx-auto">{children}</main>
            </div>
        </div>
    );
}
