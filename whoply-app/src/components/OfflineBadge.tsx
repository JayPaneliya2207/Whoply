'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '@/i18n';

/**
 * Shows an offline pill when the browser loses its connection. Whoply has no
 * offline queue — a bill made while offline is not saved — so it says that
 * plainly instead of promising a sync.
 */
export function OfflineBadge() {
    const t = useT();
    const [online, setOnline] = useState(true);
    useEffect(() => {
        setOnline(navigator.onLine);
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    if (online) return null;
    return (
        <span className="wp-chip" role="status" title={t('offlineBadgeHint')} style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
            <WifiOff size={12} /> {t('offlineBadge')}
        </span>
    );
}
