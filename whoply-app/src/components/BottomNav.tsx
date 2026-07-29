'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tabsFor } from '@/lib/nav';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';

/** Fixed bottom tab bar with the main daily-use screens (mobile-app / 1socio style). */
export function BottomNav() {
    const { user } = useAuth();
    const t = useT();
    const pathname = usePathname();
    const tabs = tabsFor(user?.business?.type);

    return (
        <nav className="sticky bottom-0 z-30" style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--card-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-md mx-auto flex items-stretch px-1 pt-1.5 pb-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = pathname === tab.href;
                    return (
                        <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center gap-1 py-1 transition-colors"
                            style={{ color: active ? 'var(--brand-700)' : 'var(--text-muted)' }}>
                            <div className="grid place-items-center h-9 w-14 rounded-xl transition-colors" style={active ? { background: 'var(--brand-100)' } : undefined}>
                                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                            </div>
                            <span className="text-[11px] font-semibold leading-none truncate max-w-full px-0.5">{t(tab.key)}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
