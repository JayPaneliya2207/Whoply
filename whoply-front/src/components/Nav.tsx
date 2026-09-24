'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Globe, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { getCopy, pathFor, LANGS, LANG_LABEL, HREF_LANG, type Lang } from '@/i18n/landing';
import { appEntry } from '@/lib/links';

/**
 * Globe button that opens the language list. Each option is a real link to
 * that locale's own page. Closes on outside click, Escape, or picking one.
 */
function LangMenu({ lang, label }: { lang: Lang; label: string }) {
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const listId = useId();

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => {
            if (!wrap.current?.contains(e.target as Node)) setOpen(false);
        };
        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                wrap.current?.querySelector('button')?.focus();
            }
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    return (
        <div ref={wrap} className="relative">
            <button
                type="button"
                aria-label={`${label}: ${LANG_LABEL[lang].full}`}
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((v) => !v)}
                className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold text-white transition-colors ${
                    open ? 'border-white/60 bg-white/15' : 'border-white/25 hover:border-white/50 hover:bg-white/10'
                }`}
            >
                <Globe size={17} aria-hidden="true" />
                <span>{LANG_LABEL[lang].short}</span>
                <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        id={listId}
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full z-50 mt-2 w-48 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-navy shadow-2xl shadow-navy/30"
                    >
                        <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">{label}</p>
                        <ul>
                            {LANGS.map((l) => {
                                const on = l === lang;
                                return (
                                    <li key={l}>
                                        <a
                                            href={pathFor(l)}
                                            hrefLang={HREF_LANG[l]}
                                            lang={HREF_LANG[l]}
                                            aria-current={on ? 'page' : undefined}
                                            onClick={() => setOpen(false)}
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                                                on ? 'bg-accent-tint text-accent-strong' : 'hover:bg-surface-2'
                                            }`}
                                        >
                                            <span
                                                className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                                                    on ? 'bg-accent text-white' : 'bg-navy-tint text-navy'
                                                }`}
                                            >
                                                {LANG_LABEL[l].short}
                                            </span>
                                            <span className="flex-1">{LANG_LABEL[l].full}</span>
                                            {on && <Check size={16} aria-hidden="true" />}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function Nav({ lang }: { lang: Lang }) {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const t = getCopy(lang);

    // Reading progress along the header's bottom edge.
    const { scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            {/* Announcement bar — scrolls away, so only the 64px nav stays sticky. */}
            <div className="hidden bg-navy-dark px-5 py-2 text-center text-xs text-white/75 sm:block">
                {t.nav.announcement}
            </div>

            {/* Solid at the top; frosted once the page moves underneath it. Colour
                only — the height never changes, so nothing below shifts. */}
            <header
                className={`sticky top-0 z-50 transition-[background-color,box-shadow] duration-300 ${
                    scrolled
                        ? 'bg-navy/80 shadow-[0_10px_30px_-12px_rgb(10,31,51,0.6)] backdrop-blur-md'
                        : 'bg-navy'
                }`}
            >
                <motion.div
                    aria-hidden="true"
                    style={{ scaleX: progress }}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent-bright"
                />
                <div className="wrap flex h-16 items-center justify-between">
                    <a href={pathFor(lang)} aria-label={t.nav.home}>
                        <Logo size={30} onNavy />
                    </a>

                    {/* gap-5 until xl — Hindi/Gujarati labels are longer than English
                        and would otherwise crowd the CTA cluster at 1024px. */}
                    <nav aria-label={t.nav.primaryNav} className="hidden items-center gap-5 lg:flex xl:gap-7">
                        {t.nav.links.map((l) => (
                            <a
                                key={l.href}
                                href={l.href}
                                className="text-sm font-medium text-[#E5E7EB] transition-colors hover:text-white"
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>

                    <div className="hidden items-center gap-4 lg:flex">
                        <LangMenu lang={lang} label={t.nav.switchLabel} />
                        <a href={appEntry(lang)} className="text-sm font-semibold text-white">
                            {t.nav.login}
                        </a>
                        <a href={appEntry(lang)} className="btn btn-primary !px-5 !py-2.5 text-sm">
                            {t.nav.start} <ArrowRight size={16} aria-hidden="true" />
                        </a>
                    </div>

                    <div className="flex items-center gap-3 lg:hidden">
                        <LangMenu lang={lang} label={t.nav.switchLabel} />
                        <button
                            type="button"
                            className="text-white"
                            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
                            aria-expanded={open}
                            aria-controls="mobile-menu"
                            onClick={() => setOpen((v) => !v)}
                        >
                            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                        </button>
                    </div>
                </div>

                {open && (
                    <div id="mobile-menu" className="border-t border-white/10 bg-navy px-5 pb-5 lg:hidden">
                        <nav aria-label={t.nav.mobileNav} className="flex flex-col py-2">
                            {t.nav.links.map((l) => (
                                <a
                                    key={l.href}
                                    href={l.href}
                                    onClick={() => setOpen(false)}
                                    className="border-b border-white/10 py-3 text-sm font-medium text-[#E5E7EB]"
                                >
                                    {l.label}
                                </a>
                            ))}
                        </nav>
                        <div className="mt-4 flex flex-col gap-3">
                            <a
                                href={appEntry(lang)}
                                className="btn btn-ghost-navy w-full"
                                onClick={() => setOpen(false)}
                            >
                                {t.nav.login}
                            </a>
                            <a
                                href={appEntry(lang)}
                                className="btn btn-primary w-full"
                                onClick={() => setOpen(false)}
                            >
                                {t.nav.start} <ArrowRight size={16} aria-hidden="true" />
                            </a>
                        </div>
                    </div>
                )}
            </header>
        </>
    );
}
