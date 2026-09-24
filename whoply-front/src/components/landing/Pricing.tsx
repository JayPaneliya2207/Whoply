'use client';

import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { appEntry } from '@/lib/links';
import { cn } from '@/lib/cn';
import { Reveal } from './Reveal';

export interface Plan {
    key: string;
    name: string;
    price: number;
    period: string;
    features: string[];
    highlight: boolean;
}

/** Yearly billing takes this much off the monthly price. */
const YEARLY_DISCOUNT = 0.2;

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** A price that counts from its old value to its new one (₹299 → ₹239). */
function AnimatedPrice({ value, className }: { value: number; className?: string }) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(value);
    const text = useTransform(mv, (v) => inr(v));
    useEffect(() => {
        if (reduce) {
            mv.set(value);
            return;
        }
        const controls = animate(mv, value, { duration: 0.9, ease: [0.33, 1, 0.68, 1] });
        return () => controls.stop();
    }, [value, mv, reduce]);
    return <motion.span className={className}>{text}</motion.span>;
}

/**
 * Plan cards with a Monthly/Yearly switch. Prices come in per month; yearly
 * shows the discounted monthly equivalent (counting to it) with the yearly
 * total under it. Cards lift on hover with a spring; the highlighted plan is
 * scaled up, wrapped in a rotating gradient ring with a soft pulsing glow,
 * and badged.
 */
export function Pricing({ lang, plans }: { lang: Lang; plans: Plan[] }) {
    const t = getCopy(lang).pricing;
    const [yearly, setYearly] = useState(false);
    const reduce = useReducedMotion();

    return (
        <>
            {/* ── Billing switch ─────────────────────────────── */}
            <div className="mt-10 flex justify-center">
                <div
                    role="radiogroup"
                    aria-label={`${t.monthly} / ${t.yearly}`}
                    className="relative flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-md backdrop-blur-md"
                >
                    {([false, true] as const).map((y) => {
                        const on = yearly === y;
                        return (
                            <button
                                key={String(y)}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setYearly(y)}
                                className={cn(
                                    'relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
                                    on ? 'text-white' : 'text-muted hover:text-navy'
                                )}
                            >
                                {on && (
                                    <motion.span
                                        layoutId="billing-pill"
                                        className="absolute inset-0 rounded-full bg-navy"
                                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                    />
                                )}
                                <span className="relative">{y ? t.yearly : t.monthly}</span>
                                {y && (
                                    <motion.span
                                        // Re-keyed on each switch so the bounce replays when yearly turns on.
                                        key={String(yearly)}
                                        initial={false}
                                        animate={yearly && !reduce ? { scale: [1, 1.3, 0.92, 1.06, 1] } : { scale: 1 }}
                                        transition={{ duration: 0.55, ease: 'easeOut' }}
                                        className={cn(
                                            'relative rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors',
                                            on ? 'bg-success text-white' : 'bg-success-tint text-success'
                                        )}
                                    >
                                        {t.save}
                                    </motion.span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Plans ──────────────────────────────────────── */}
            <div className="mt-14 grid items-center gap-10 md:grid-cols-3 md:gap-5 lg:gap-7">
                {plans.map((p, i) => {
                    const hi = p.highlight;
                    const monthly = yearly ? p.price * (1 - YEARLY_DISCOUNT) : p.price;
                    const free = p.price === 0;

                    const body = (
                        <div
                            className={cn(
                                'relative flex h-full flex-col bg-white/90 p-7 backdrop-blur-md',
                                hi ? 'rounded-[1.4rem]' : 'rounded-3xl border border-slate-300/70 shadow-md'
                            )}
                        >
                            {hi && (
                                <span className="absolute -top-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg shadow-accent/30">
                                    <Sparkles size={13} aria-hidden="true" />
                                    {t.popular}
                                </span>
                            )}

                            <h3 className="font-display text-xl font-extrabold text-navy">{p.name}</h3>
                            <p className="mt-1 text-sm text-muted">{t.planFor[p.key] ?? ''}</p>

                            <div className="mt-6 flex items-end gap-1">
                                <AnimatedPrice
                                    value={monthly}
                                    className={cn(
                                        'tabular font-display text-[2.6rem] leading-none font-extrabold',
                                        hi ? 'text-accent-strong' : 'text-navy'
                                    )}
                                />
                                <span className="pb-1 text-muted">/{t.per}</span>
                            </div>
                            {/* Fixed height so the cards don't jump when the line appears. */}
                            <p className="mt-2 h-5 text-sm text-muted">
                                {yearly && !free && (
                                    <motion.span
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="tabular line-through decoration-muted/60">{inr(p.price)}</span>
                                        <span className="font-semibold text-success">{t.billedYearly(inr(monthly * 12))}</span>
                                    </motion.span>
                                )}
                            </p>

                            <ul className="mt-6 space-y-3 border-t border-slate-200/80 pt-6">
                                {p.features.map((f) => (
                                    <li key={f} className="flex gap-2.5 text-[0.95rem] text-text">
                                        <span
                                            className={cn(
                                                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                                                hi ? 'bg-accent text-white' : 'bg-success-tint text-success'
                                            )}
                                        >
                                            <Check size={12} strokeWidth={3} aria-hidden="true" />
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto pt-8">
                                <a href={appEntry(lang)} className={cn('btn w-full', hi ? 'btn-primary btn-shine' : 'btn-secondary')}>
                                    {free ? t.startFree : t.choose(p.name)}
                                </a>
                            </div>
                        </div>
                    );

                    return (
                        <Reveal key={p.key} delay={i * 120} className={cn('h-full', hi && 'relative z-10 md:scale-105')}>
                            <motion.div
                                whileHover={reduce ? undefined : { y: -8 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className={cn(
                                    'group relative isolate h-full rounded-3xl transition-shadow duration-300',
                                    hi ? 'shadow-2xl shadow-accent/25' : 'hover:shadow-xl hover:shadow-navy/10'
                                )}
                            >
                                {hi ? (
                                    <>
                                        {/* Soft glow that breathes behind the ring. */}
                                        <motion.span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-accent/40 via-sand/40 to-accent/40 blur-2xl"
                                            animate={reduce ? undefined : { opacity: [0.55, 0.9, 0.55], scale: [0.98, 1.02, 0.98] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                        {/* Rotating gradient ring, 2px wide. */}
                                        <div className="ring-spin h-full rounded-3xl p-[2px]">{body}</div>
                                    </>
                                ) : (
                                    body
                                )}
                            </motion.div>
                        </Reveal>
                    );
                })}
            </div>
        </>
    );
}
