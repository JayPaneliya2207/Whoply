'use client';
import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';

/**
 * Shop Open / Closed status pill shown on the dashboard header.
 * Tap toggles the status (green = open, red = closed); persisted per business
 * in localStorage so each shop remembers its own state on this device.
 */
export function ShopStatusToggle() {
    const { user } = useAuth();
    const t = useT();
    const key = `whoply_shop_open_${user?.business?.id || 'default'}`;
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem(key);
        if (stored !== null) setOpen(stored === '1');
    }, [key]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        localStorage.setItem(key, next ? '1' : '0');
    };

    // Keep layout stable before hydration (default to "open" look).
    const isOpen = mounted ? open : true;
    const tone = isOpen
        ? { bg: '#dcfce7', fg: 'var(--success-600)', dot: 'var(--success-500)' }
        : { bg: '#fee2e2', fg: 'var(--danger-500)', dot: 'var(--danger-500)' };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={isOpen}
            title={isOpen ? t('shopOpen') : t('shopClosed')}
            className="flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-xs font-bold transition-colors active:scale-95"
            style={{ background: tone.bg, color: tone.fg }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
            <Power size={13} strokeWidth={2.6} />
            {isOpen ? t('shopOpen') : t('shopClosed')}
        </button>
    );
}
