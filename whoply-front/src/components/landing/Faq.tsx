'use client';

import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
    CloudOff,
    Database,
    FileSpreadsheet,
    LayoutGrid,
    Plus,
    ReceiptIndianRupee,
    RefreshCw,
    Smartphone,
    Tablet,
    type LucideIcon,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';

/* Category of each question in `faq.qa`, in order:
   1 hardware & offline · 2 tax & staff · 3 data & onboarding. */
const CAT_OF = [1, 3, 2, 2, 3, 3, 1, 3];
const CAT_ICONS: LucideIcon[] = [LayoutGrid, Smartphone, ReceiptIndianRupee, Database];

/** A small proof badge shown under certain answers. */
function Proof({ icons, text, tone }: { icons: LucideIcon[]; text: string; tone: 'navy' | 'green' | 'orange' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className={cn(
                'mt-3 inline-flex max-w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold',
                tone === 'navy' && 'border-navy/15 bg-navy-tint text-navy',
                tone === 'green' && 'border-success/25 bg-success-tint text-success',
                tone === 'orange' && 'border-accent/25 bg-accent-tint text-accent-strong'
            )}
        >
            <span className="flex shrink-0 -space-x-1.5">
                {icons.map((Icon, k) => (
                    <span key={k} className="grid h-7 w-7 place-items-center rounded-full bg-white shadow-sm ring-2 ring-white">
                        <Icon size={14} aria-hidden="true" />
                    </span>
                ))}
            </span>
            <span className="min-w-0">{text}</span>
        </motion.div>
    );
}

/**
 * Visual FAQ hub: category pills filter a two-column grid of glass question
 * cards (filtering animates with AnimatePresence + layout). Opening a card
 * reveals the answer and, for some questions, a proof badge. Answers of the
 * visible cards stay in the DOM while closed, so search engines read them.
 */
export function Faq({ lang }: { lang: Lang }) {
    const { qa, cats, proof } = getCopy(lang).faq;
    const [cat, setCat] = useState(0);
    const [open, setOpen] = useState<number | null>(0);
    const reduce = useReducedMotion();
    const uid = useId();

    const proofFor: Record<number, ReactNode> = {
        0: <Proof icons={[Smartphone, Tablet]} text={proof.devices} tone="navy" />,
        2: <Proof icons={[ReceiptIndianRupee, FileSpreadsheet]} text={proof.export} tone="green" />,
        6: <Proof icons={[CloudOff, RefreshCw]} text={proof.offline} tone="orange" />,
    };

    const visible = qa.map((item, i) => ({ item, i })).filter(({ i }) => cat === 0 || CAT_OF[i] === cat);
    const count = (c: number) => (c === 0 ? qa.length : CAT_OF.filter((x) => x === c).length);

    return (
        <div className="mx-auto mt-10 max-w-5xl">
            {/* ── Category pills ───────────────────────────────── */}
            <div role="tablist" aria-label={cats[0]} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
                {cats.map((label, c) => {
                    const on = c === cat;
                    const Icon = CAT_ICONS[c];
                    return (
                        <button
                            key={label}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls={`${uid}-grid`}
                            onClick={() => {
                                setCat(c);
                                setOpen(null);
                            }}
                            className={cn(
                                'relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
                                on ? 'border-navy text-white' : 'border-slate-200 bg-white/80 text-navy backdrop-blur-md hover:border-accent/40'
                            )}
                        >
                            {on && (
                                <motion.span
                                    layoutId="faq-cat"
                                    className="absolute inset-0 rounded-full bg-navy shadow-lg shadow-navy/25"
                                    transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                                />
                            )}
                            <Icon size={15} aria-hidden="true" className={cn('relative', on ? 'text-sand' : 'text-accent-strong')} />
                            <span className="relative">{label}</span>
                            <span
                                className={cn(
                                    'relative rounded-full px-1.5 text-[11px] font-bold',
                                    on ? 'bg-white/20 text-white' : 'bg-navy-tint text-navy/70'
                                )}
                            >
                                {count(c)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Two-column card grid ─────────────────────────── */}
            <LayoutGroup>
                <motion.ul id={`${uid}-grid`} role="tabpanel" layout className="mt-8 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {visible.map(({ item: [q, a], i }) => {
                            const on = open === i;
                            const btnId = `${uid}-q-${i}`;
                            const panelId = `${uid}-a-${i}`;
                            return (
                                <motion.li
                                    key={q}
                                    layout={reduce ? false : true}
                                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                    className={cn(
                                        'rounded-2xl border p-5 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300',
                                        on
                                            ? 'border-orange-300 bg-orange-50/70 shadow-lg shadow-accent/10'
                                            : 'border-slate-200/80 bg-white/80 shadow-sm hover:border-slate-300 hover:shadow-md'
                                    )}
                                >
                                    <motion.h3 layout="position">
                                        <button
                                            id={btnId}
                                            type="button"
                                            aria-expanded={on}
                                            aria-controls={panelId}
                                            onClick={() => setOpen(on ? null : i)}
                                            className="flex w-full items-start justify-between gap-4 text-left font-semibold text-navy"
                                        >
                                            <span className="pt-1">{q}</span>
                                            <motion.span
                                                aria-hidden="true"
                                                animate={{ rotate: on ? 45 : 0 }}
                                                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 18 }}
                                                className={cn(
                                                    'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-300',
                                                    on ? 'bg-accent text-white' : 'bg-accent-tint text-accent-strong'
                                                )}
                                            >
                                                <Plus size={17} strokeWidth={2.5} />
                                            </motion.span>
                                        </button>
                                    </motion.h3>
                                    <motion.div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={btnId}
                                        aria-hidden={!on}
                                        inert={!on}
                                        initial={false}
                                        animate={on ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                                        transition={
                                            reduce
                                                ? { duration: 0 }
                                                : { height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.22 } }
                                        }
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-3">
                                            <p className="text-[0.95rem] leading-relaxed text-text/80">{a}</p>
                                            {on && proofFor[i]}
                                        </div>
                                    </motion.div>
                                </motion.li>
                            );
                        })}
                    </AnimatePresence>
                </motion.ul>
            </LayoutGroup>
        </div>
    );
}
