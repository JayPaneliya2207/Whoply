'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { useT } from '@/i18n';

interface Popup { _id: string; title: string; body: string; linkUrl: string; linkLabel: string; imagePath: string }

/**
 * Popups from the Whoply team — an offer poster, a news headline, a notice
 * (made in the admin panel, with an on / off switch and dates). Asked for once
 * each time the app is opened or refreshed; closing it keeps it closed until
 * the next refresh. It never blocks the app: the cross, a tap outside and
 * Escape all close it.
 */
export function AnnouncementPopup() {
    const t = useT();
    const [at, setAt] = useState(0);
    const [closed, setClosed] = useState(false);
    const { data } = useQuery({
        queryKey: ['announcements'],
        queryFn: async () => ((await api.get('/announcements')).data.data.items || []) as Popup[],
        staleTime: Infinity, // once per app load
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false, // a popup is never worth an error on screen
    });
    const items = data || [];
    const open = !closed && items.length > 0;
    const p = items[Math.min(at, items.length - 1)];

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClosed(true);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const src = p?.imagePath ? (p.imagePath.startsWith('https://') ? p.imagePath : API_URL + p.imagePath) : '';
    const more = at < items.length - 1;

    return (
        <AnimatePresence>
            {open && p && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label={p.title}>
                    <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setClosed(true)} />
                    <motion.div
                        key={p._id}
                        className="relative w-full max-w-sm max-h-[88dvh] flex flex-col overflow-hidden rounded-3xl"
                        style={{ background: 'var(--card-bg)', boxShadow: 'var(--shadow-lg)' }}
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    >
                        <button onClick={() => setClosed(true)} aria-label={t('close')} className="absolute top-3 right-3 z-10 h-10 w-10 grid place-items-center rounded-full" style={{ background: 'rgba(15,23,42,0.6)', color: '#fff' }}>
                            <X size={19} />
                        </button>
                        <div className="overflow-y-auto wp-scroll">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {src && <img src={src} alt="" className="block w-full max-h-[52dvh] object-contain" style={{ background: 'var(--surface-2)' }} />}
                            <div className="p-5">
                                <p className={`text-lg font-extrabold leading-snug ${src ? '' : 'pr-10'}`} style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                                {p.body && <p className="text-sm mt-2 whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)' }}>{p.body}</p>}
                                <div className="flex gap-2 mt-4">
                                    {p.linkUrl && (
                                        <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className="wp-btn wp-btn-primary flex-1">
                                            {p.linkLabel || t('popupOpen')} <ExternalLink size={15} />
                                        </a>
                                    )}
                                    {more
                                        ? <button className={`wp-btn wp-btn-ghost ${p.linkUrl ? '' : 'flex-1'}`} onClick={() => setAt((i) => i + 1)}>{t('popupNext')} <ArrowRight size={15} /></button>
                                        : !p.linkUrl && <button className="wp-btn wp-btn-ghost flex-1" onClick={() => setClosed(true)}>{t('close')}</button>}
                                </div>
                                {items.length > 1 && <p className="text-xs text-center mt-3 tabular" style={{ color: 'var(--text-muted)' }}>{at + 1} / {items.length}</p>}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
