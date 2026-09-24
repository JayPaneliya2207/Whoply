'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
    Boxes,
    Check,
    ChevronRight,
    ClipboardList,
    ReceiptIndianRupee,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';
import { retailGroupScreens } from './FeatureScreens';

const CYCLE_MS = 6000;

/** "Title — detail" bullets become a tab title and the text under it. */
function split(bullet: string): [string, string] {
    const i = bullet.indexOf(' — ');
    if (i === -1) return [bullet, ''];
    const rest = bullet.slice(i + 3);
    return [bullet.slice(0, i), rest.charAt(0).toUpperCase() + rest.slice(1)];
}

interface Item {
    title: string;
    detail: string;
    Icon: LucideIcon;
    /** Capabilities folded into this tab, shown as chips when it's open. */
    chips?: string[];
}

/* Which retail bullets each of the four groups covers (indexes into
   `shopkeepers.bullets`), and their icons. */
const RETAIL_GROUPS: { bullets: number[]; Icon: LucideIcon }[] = [
    { bullets: [0, 5, 6], Icon: ReceiptIndianRupee }, // billing, quotes, returns
    { bullets: [1, 3], Icon: Boxes }, // expiry, reorder
    { bullets: [2, 4], Icon: Wallet }, // udhar, profit tonight
    { bullets: [7], Icon: ClipboardList }, // suppliers & POs
];

/**
 * Retail feature tabs with a live device mockup: the eight retail features
 * grouped into four tabs, each listing the capabilities it covers.
 * Desktop: list on one side, a sticky device on the other that
 * cross-fades screens, auto-stepping until someone picks a tab. Phone: an
 * accordion whose open item carries its own mockup.
 */
export function FeatureTabs({ lang, className }: { lang: Lang; className?: string }) {
    const t = getCopy(lang);
    const section = t.shopkeepers;
    const bullets = section.bullets.map(split);

    const items: Item[] = RETAIL_GROUPS.map((g, i) => ({
        title: section.groups[i].title,
        detail: section.groups[i].body,
        Icon: g.Icon,
        chips: g.bullets.map((b) => bullets[b][0]),
    }));
    const screens = retailGroupScreens(lang);

    const [active, setActive] = useState(0);
    const [auto, setAuto] = useState(true);
    const [desktop, setDesktop] = useState(false);
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const inView = useInView(box, { amount: 0.4 });
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const uid = useId();

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const on = () => setDesktop(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    // Autoplay only on desktop, in view, until the first real interaction.
    const cycling = auto && desktop && inView && !reduce;
    useEffect(() => {
        if (!cycling) return;
        const id = setTimeout(() => setActive((a) => (a + 1) % items.length), CYCLE_MS);
        return () => clearTimeout(id);
    }, [cycling, active, items.length]);

    const pick = (i: number) => {
        setAuto(false);
        setActive(i);
    };

    const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (e.key === 'Home' || e.key === 'End' || next) {
            e.preventDefault();
            const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + next + items.length) % items.length;
            pick(j);
            tabs.current[j]?.focus();
        }
    };

    const device = (
        <Device
            title={items[active].title}
            business={t.hero.mock.retailBusiness}
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={active}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="origin-top"
                >
                    {screens[active]}
                </motion.div>
            </AnimatePresence>
        </Device>
    );

    return (
        <div
            ref={box}
            className={cn('grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-14', className)}
        >
            <div
                role="tablist"
                aria-orientation="vertical"
                aria-label={section.mock.tabsLabel}
                className="min-w-0 space-y-3"
            >
                {items.map((it, i) => {
                    const on = i === active;
                    const Icon = it.Icon;
                    return (
                        <div
                            key={it.title}
                            className={cn(
                                'group relative overflow-hidden rounded-2xl border border-l-4 transition-[background-color,border-color,box-shadow,transform] duration-300',
                                on
                                    ? 'border-slate-200/90 border-l-accent bg-accent-tint/60 shadow-lg shadow-accent/10'
                                    : 'border-slate-200/90 border-l-transparent bg-white/60 hover:-translate-y-0.5 hover:border-slate-300 hover:border-l-accent/40 hover:bg-white hover:shadow-md'
                            )}
                        >
                            <button
                                ref={(el) => {
                                    tabs.current[i] = el;
                                }}
                                id={`${uid}-tab-${i}`}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                aria-controls={`${uid}-panel`}
                                tabIndex={on ? 0 : -1}
                                onClick={() => pick(i)}
                                onKeyDown={(e) => onKey(e, i)}
                                className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
                            >
                                <motion.span
                                    animate={on && !reduce ? { rotate: [0, -10, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                                    transition={{ duration: 0.6 }}
                                    className={cn(
                                        'grid shrink-0 place-items-center rounded-xl transition-colors duration-300',
                                        'h-11 w-11',
                                        on ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-navy-tint text-navy group-hover:bg-accent-tint group-hover:text-accent-strong'
                                    )}
                                >
                                    <Icon size={20} aria-hidden="true" />
                                </motion.span>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            'block text-[11px] font-bold tracking-[0.14em] uppercase',
                                            on ? 'text-accent-strong' : 'text-muted'
                                        )}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span
                                        className={cn(
                                            'block font-display font-bold',
                                            'text-[1.08rem]',
                                            on ? 'text-navy' : 'text-navy/75'
                                        )}
                                    >
                                        {it.title}
                                    </span>
                                </span>
                                <ChevronRight
                                    size={18}
                                    aria-hidden="true"
                                    className={cn(
                                        'shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5',
                                        on && 'rotate-90 text-accent-strong lg:rotate-0'
                                    )}
                                />
                            </button>

                            <AnimatePresence initial={false}>
                                {on && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-4 pl-[4.6rem]">
                                            {it.detail && <p className="text-[0.95rem] leading-relaxed text-text/80">{it.detail}</p>}
                                            {it.chips && (
                                                <ul className="mt-3 flex flex-wrap gap-1.5">
                                                    {it.chips.map((c, k) => (
                                                        <motion.li
                                                            key={c}
                                                            initial={{ opacity: 0, y: 4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.12 + k * 0.06 }}
                                                            className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-white px-2.5 py-1 text-xs font-semibold text-navy"
                                                        >
                                                            <Check size={12} strokeWidth={3} className="text-success" aria-hidden="true" />
                                                            {c}
                                                        </motion.li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        {/* Phone: the mockup lives inside the open item. */}
                                        <div className="px-3 pb-3 lg:hidden">{device}</div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Autoplay progress along the bottom of the open item. */}
                            {on && cycling && (
                                <motion.span
                                    key={`p-${active}`}
                                    aria-hidden="true"
                                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            <div
                id={`${uid}-panel`}
                role="tabpanel"
                aria-labelledby={`${uid}-tab-${active}`}
                className="hidden lg:sticky lg:top-24 lg:block"
            >
                {device}
            </div>
        </div>
    );
}

/** A tablet-ish frame: app bar with the business and screen name, content below. */
function Device({ title, business, children }: { title: string; business: string; children: ReactNode }) {
    return (
        <div className="relative rounded-[1.75rem] bg-gradient-to-br from-[#ffedd5] via-white to-navy-tint p-3 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 sm:p-5">
            <div className="relative overflow-hidden rounded-[1.25rem] border-[6px] border-navy bg-white shadow-2xl shadow-slate-900/25">
                <div className="flex items-center gap-2 bg-navy px-4 py-2.5 text-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="truncate text-[11px] text-white/80">{business}</span>
                    <span className="ml-auto truncate text-xs font-semibold">{title}</span>
                </div>
                <div className="min-h-[22rem] p-4 sm:p-5">{children}</div>
            </div>
        </div>
    );
}
