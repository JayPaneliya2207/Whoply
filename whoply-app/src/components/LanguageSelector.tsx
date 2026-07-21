'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLang, LANGS, type Lang } from '@/i18n';
import { api } from '@/lib/api';

/** Compact language switcher for the header. Persists locally + to the user profile. */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
    const { lang, setLang } = useLang();
    const [open, setOpen] = useState(false);
    const current = LANGS.find((l) => l.code === lang);

    const choose = (code: Lang) => {
        setLang(code);
        setOpen(false);
        api.patch('/auth/profile', { language: code }).catch(() => { /* best-effort */ });
    };

    return (
        <div className="relative">
            <button className="wp-btn wp-btn-ghost !px-2.5 !py-2 gap-1.5" onClick={() => setOpen((v) => !v)} aria-label="Language">
                <Globe size={17} />
                {!compact && <span className="text-sm">{current?.native}</span>}
                <ChevronDown size={14} />
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            className="absolute right-0 mt-2 w-40 wp-card p-1.5 z-50" style={{ boxShadow: 'var(--shadow-lg)' }}>
                            {LANGS.map((l) => (
                                <button key={l.code} onClick={() => choose(l.code)}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm"
                                    style={lang === l.code ? { background: 'var(--surface-2)', color: 'var(--brand-700)' } : { color: 'var(--text-secondary)' }}>
                                    {l.native} {lang === l.code && <Check size={14} />}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Inline pill row of languages — used on the login screen. */
export function LanguagePills() {
    const { lang, setLang } = useLang();
    return (
        <div className="flex gap-1.5">
            {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} className="wp-chip px-3 py-1.5 text-sm"
                    style={lang === l.code ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {l.native}
                </button>
            ))}
        </div>
    );
}
