'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { appEntry, whatsappLink, WHATSAPP_NUMBER } from '@/lib/links';

/**
 * Mobile: a bottom bar with "Start free" + WhatsApp. Desktop: a floating
 * WhatsApp button. Both appear once the hero CTA has scrolled away and step
 * aside when the final CTA comes into view, so they never cover the footer or
 * sit next to a CTA that is already on screen.
 */
export function StickyCta({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const finalCta = document.getElementById('final-cta');
        let frame = 0;
        const update = () => {
            frame = 0;
            const pastHero = window.scrollY > 600;
            const beforeEnd = !finalCta || finalCta.getBoundingClientRect().top > window.innerHeight;
            setShow(pastHero && beforeEnd);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            cancelAnimationFrame(frame);
        };
    }, []);

    const wa = WHATSAPP_NUMBER ? whatsappLink(t.contact.whatsappMsg) : null;

    return (
        <>
            {/* Mobile bar */}
            <div
                inert={!show}
                className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy/95 px-4 pt-3 backdrop-blur transition-transform duration-300 ease-out lg:hidden ${
                    show ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
                <div className="flex items-center gap-3">
                    <a href={appEntry(lang)} className="btn btn-primary flex-1 !py-3">
                        {t.nav.start} <ArrowRight size={17} aria-hidden="true" />
                    </a>
                    {wa && (
                        <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t.contact.whatsapp}
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#25D366] text-white"
                        >
                            <MessageCircle size={22} aria-hidden="true" />
                        </a>
                    )}
                </div>
            </div>

            {/* Desktop floating WhatsApp */}
            {wa && (
                <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    inert={!show}
                    className={`group fixed right-6 bottom-6 z-40 hidden items-center gap-2 rounded-full bg-[#25D366] py-3 pr-5 pl-4 font-semibold text-white shadow-[0_12px_30px_-10px_rgb(37,211,102,0.6)] transition-[opacity,transform] duration-300 ease-out hover:-translate-y-0.5 lg:flex ${
                        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
                    }`}
                >
                    <MessageCircle size={20} aria-hidden="true" />
                    <span className="text-sm">{t.contact.whatsapp}</span>
                </a>
            )}
        </>
    );
}
