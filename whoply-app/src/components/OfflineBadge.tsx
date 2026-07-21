'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Shows an offline pill when the browser loses connectivity (offline-first POS cue). */
export function OfflineBadge() {
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
        <span className="wp-chip" style={{ background: '#fef3c7', color: 'var(--accent-600)' }}>
            <WifiOff size={12} /> Offline — bills will sync
        </span>
    );
}
