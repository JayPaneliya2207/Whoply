'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { chime } from '@/lib/push';

/** Bell icon in the header — shows the unread count and links to the notifications page. */
export function NotificationBell() {
    const { user } = useAuth();
    const base = user?.business?.type === 'wholesale' ? '/wholesaler' : '/shopkeeper';
    const qc = useQueryClient();
    const { data } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => (await api.get(`${base}/notifications`)).data.data,
        refetchInterval: 30000,
    });

    const unread = data?.unread || 0;

    // A phone notification that lands while the app is open: the service worker says so, and the bell refreshes at once.
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const onMessage = (e: MessageEvent) => { if (e.data?.type === 'whoply-push') qc.invalidateQueries({ queryKey: ['notifications'] }); };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [qc]);

    // A chime when something new arrives — not for what was already waiting when the app opened.
    const seen = useRef<number | null>(null);
    useEffect(() => {
        if (!data) return;
        if (seen.current !== null && unread > seen.current) chime();
        seen.current = unread;
    }, [data, unread]);

    return (
        <Link href="/notifications" className="wp-btn wp-btn-ghost !px-2.5 relative" aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--danger-fill)' }}>
                    {unread}
                </span>
            )}
        </Link>
    );
}
