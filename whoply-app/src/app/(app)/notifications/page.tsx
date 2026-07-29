'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCheck, BellOff, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useT } from '@/i18n';
import { useAuth } from '@/stores/auth.store';

const typeIcon: Record<string, string> = { summary: '📊', low_stock: '📦', udhar: '💰', expiry: '⏰', order: '🚚', payable: '💸', general: '🔔' };
type Filter = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
    const t = useT();
    const qc = useQueryClient();
    const router = useRouter();
    const { user } = useAuth();
    const isWholesale = user?.business?.type === 'wholesale';
    const base = isWholesale ? '/wholesaler' : '/shopkeeper';
    const [filter, setFilter] = useState<Filter>('all');

    const { data } = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get(`${base}/notifications`)).data.data });
    const readAll = useMutation({ mutationFn: async () => api.post(`${base}/notifications/read-all`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
    const readOne = useMutation({ mutationFn: async (id: string) => api.post(`${base}/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

    // Where each notification type takes the user.
    const routeFor = (type: string): string | null => {
        switch (type) {
            case 'summary': return '/dashboard';
            case 'low_stock': return '/products?lowStock=true';
            case 'expiry': return '/products';
            case 'udhar': return isWholesale ? '/dealers' : '/customers?hasDue=true';
            case 'order': return isWholesale ? '/orders' : '/bills';
            case 'payable': return '/purchases';
            default: return null;
        }
    };

    const open = (n: any) => {
        if (!n.isRead) readOne.mutate(n._id);
        const to = routeFor(n.type);
        if (to) router.push(to);
    };

    const allItems = data?.items || [];
    const unreadCount = data?.unread ?? allItems.filter((n: any) => !n.isRead).length;
    const items = filter === 'all' ? allItems : allItems.filter((n: any) => (filter === 'unread' ? !n.isRead : n.isRead));

    const filters: { key: Filter; label: string; count?: number }[] = [
        { key: 'all', label: t('notifAll'), count: allItems.length },
        { key: 'unread', label: t('notifUnread'), count: unreadCount },
        { key: 'read', label: t('notifRead') },
    ];

    return (
        <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('notifications')}</h1>
                {unreadCount > 0 && <button className="wp-btn wp-btn-ghost text-sm" onClick={() => readAll.mutate()}><CheckCheck size={15} /> {t('markAllRead')}</button>}
            </div>

            {/* Read / Unread filter */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {filters.map((f) => {
                    const active = filter === f.key;
                    return (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
                            style={active ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}>
                            {f.label}
                            {f.count != null && f.count > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={active ? { background: 'var(--brand-100)', color: 'var(--brand-700)' } : { background: 'var(--card-border)', color: 'var(--text-muted)' }}>{f.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="wp-card p-10 text-center">
                    <BellOff size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>{t('noNotifications')}</p>
                </div>
            )}

            <div className="space-y-2">
                {items.map((n: any, i: number) => {
                    const clickable = !!routeFor(n.type);
                    return (
                        <motion.button key={n._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                            onClick={() => open(n)} disabled={!clickable && n.isRead}
                            className="wp-card wp-card-hover p-4 flex gap-3 w-full text-left" style={!n.isRead ? { borderLeft: '3px solid var(--brand-700)' } : {}}>
                            <span className="text-2xl">{typeIcon[n.type] || '🔔'}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                                    {!n.isRead && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--brand-700)' }} />}
                                </div>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {clickable && <ChevronRight size={18} className="self-center shrink-0" style={{ color: 'var(--text-muted)' }} />}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
