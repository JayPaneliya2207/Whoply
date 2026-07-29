'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';

/** Bell icon in the header — shows the unread count and links to the notifications page. */
export function NotificationBell() {
    const { user } = useAuth();
    const base = user?.business?.type === 'wholesale' ? '/wholesaler' : '/shopkeeper';
    const { data } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => (await api.get(`${base}/notifications`)).data.data,
        refetchInterval: 60000,
    });

    const unread = data?.unread || 0;

    return (
        <Link href="/notifications" className="wp-btn wp-btn-ghost !px-2.5 relative" aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--danger-500)' }}>
                    {unread}
                </span>
            )}
        </Link>
    );
}
