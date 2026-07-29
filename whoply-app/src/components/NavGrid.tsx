'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { groupsFor, tabsFor } from '@/lib/nav';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';

// App-icon tones — rotated across tiles so the home screen reads like a phone launcher.
const TONES = [
    { bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
    { bg: '#dcfce7', fg: 'var(--success-600)' },
    { bg: '#fef3c7', fg: 'var(--accent-600)' },
    { bg: '#e0e7ff', fg: 'var(--brand-700)' },
    { bg: '#fee2e2', fg: 'var(--danger-500)' },
    { bg: '#e0f2fe', fg: '#0369a1' },
];

/** The dashboard "home screen": app tiles grouped under section headings. */
export function NavGrid() {
    const { user } = useAuth();
    const t = useT();
    // Items already in the bottom tab bar are excluded here so nothing repeats.
    const inTabs = new Set(tabsFor(user?.business?.type).map((x) => x.href));
    const groups = groupsFor(user?.business?.type)
        .map((g) => ({ ...g, items: g.items.filter((it) => !inTabs.has(it.href)) }))
        .filter((g) => g.items.length > 0);
    let i = 0;

    return (
        <div className="space-y-5">
            {groups.map((group) => (
                <div key={group.title}>
                    <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>{t(group.title)}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const tone = TONES[i++ % TONES.length];
                            return (
                                <motion.div key={item.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                    <Link href={item.href}
                                        className="group flex items-center gap-3 rounded-2xl p-3 transition-all active:scale-[0.98] hover:-translate-y-0.5"
                                        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                                        <div className="h-11 w-11 grid place-items-center rounded-xl shrink-0 transition-transform group-hover:scale-105"
                                            style={{ background: tone.bg, color: tone.fg }}>
                                            <Icon size={22} />
                                        </div>
                                        <span className="text-sm font-semibold leading-tight line-clamp-2 flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>{t(item.key)}</span>
                                        <ChevronRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
