'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowDown, CheckCircle2, MessageCircle, NotebookPen, Smartphone, X } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';
import { Reveal } from './Reveal';

type Copy = ReturnType<typeof getCopy>['problem']['compare'];

/* Ragged bottom edge of the torn register page, in a 100×10 box. Fixed
   points (not random) so server and client draw the same tear. */
const TEAR = [0, 3, 1, 6, 2, 5, 1, 7, 3, 2, 6, 1, 4, 8, 2, 5, 3, 1, 6, 2, 4, 7, 1, 3, 5, 2];
const TEAR_PATH =
    'M0 0 L100 0 ' +
    TEAR.map((y, i) => `L${(100 - (i * 100) / (TEAR.length - 1)).toFixed(2)} ${y + 1}`).join(' ') +
    ' Z';

/* Udhar lines scribbled in the register header: [name, amount, struck out]. */
const LEDGER: [string, string, boolean][] = [
    ['Ramesh', '₹1,200', true],
    ['Sunita', '₹500', true],
    ['Mohan', '₹350', false],
];

/**
 * Paper register vs Whoply. Desktop: a torn, ruled register page beside a
 * dark live ledger, rows lined up across both through subgrid, with a "vs"
 * seal between them. Phone: the same two cards stacked as a story — paper
 * first, an animated connector, then Whoply.
 */
export function PaperVsWhoply({ lang }: { lang: Lang }) {
    const c = getCopy(lang).problem.compare;
    const n = c.rows.length;

    return (
        <div
            className="relative mt-14 grid grid-cols-1 md:grid-cols-2 md:gap-x-8 md:[grid-template-rows:auto_repeat(var(--rows),auto)]"
            style={{ '--rows': n, '--span': n + 1 } as CSSProperties}
        >
            <Reveal variant="left" className="relative md:grid md:grid-rows-subgrid md:[grid-row:span_var(--span)]">
                <PaperPanel c={c} />
            </Reveal>

            <FlowConnector label={c.flow} />

            <Reveal variant="right" className="relative md:grid md:grid-rows-subgrid md:[grid-row:span_var(--span)]">
                <WhoplyPanel c={c} />
            </Reveal>

            {/* The "vs" seal where the panels meet (desktop only). */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute top-10 left-1/2 z-20 hidden h-12 w-12 -translate-x-1/2 place-items-center rounded-full border-4 border-bg bg-accent font-display text-sm font-extrabold text-white shadow-lg md:grid"
            >
                {c.vs}
            </span>
        </div>
    );
}

/* ── Paper register ───────────────────────────────────── */

function PaperPanel({ c }: { c: Copy }) {
    return (
        <div className="paper-sheet relative rounded-t-2xl pb-2 text-[#3b2a20] shadow-[0_18px_40px_-24px_rgb(59,42,32,0.55)] md:grid md:grid-rows-subgrid md:[grid-row:span_var(--span)]">
            {/* Punched holes down the binding edge. */}
            <div aria-hidden="true" className="absolute top-6 bottom-6 left-3 flex flex-col justify-around">
                {[0, 1, 2, 3, 4].map((k) => (
                    <span key={k} className="h-3 w-3 rounded-full bg-bg shadow-[inset_0_1px_2px_rgb(0,0,0,0.25)]" />
                ))}
            </div>

            <header className="relative px-6 pt-6 pb-4 pl-12 sm:px-8 sm:pl-14">
                <p className="flex items-center gap-2 font-hand text-2xl leading-tight font-bold">
                    <NotebookPen size={20} aria-hidden="true" className="shrink-0 text-danger" />
                    {c.paper}
                </p>
                <p className="mt-0.5 text-sm text-[#6b5647]">{c.paperSub}</p>

                {/* Udhar lines, two struck through in red. */}
                <ul className="mt-4 space-y-1 font-hand text-lg leading-7">
                    {LEDGER.map(([name, amt, struck]) => (
                        <li key={name} className="flex items-center gap-3">
                            <span className={cn('relative', struck && 'text-[#3b2a20]/55')}>
                                {name} — {amt}
                                {struck && (
                                    <motion.span
                                        aria-hidden="true"
                                        className="absolute top-1/2 -right-1 -left-1 h-[2px] origin-left -rotate-2 rounded-full bg-danger"
                                        initial={{ scaleX: 0 }}
                                        whileInView={{ scaleX: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
                                    />
                                )}
                            </span>
                            {struck && (
                                <span className="-rotate-6 font-hand text-base font-bold text-danger">{c.paperNote}</span>
                            )}
                        </li>
                    ))}
                </ul>
            </header>

            {c.rows.map((r) => (
                <div key={r.topic} className="relative border-t border-dashed border-[#d8c9ad] px-6 py-5 pl-12 sm:px-8 sm:pl-14">
                    <div className="flex items-start justify-between gap-3">
                        <p className="font-hand text-lg leading-tight font-bold">{r.topic}</p>
                        <span className="inline-flex shrink-0 -rotate-3 items-center gap-1 rounded-[40%] border-2 border-danger/80 px-2.5 py-0.5 font-hand text-sm font-bold text-danger">
                            <X size={13} strokeWidth={3} aria-hidden="true" />
                            {r.paperTag}
                        </span>
                    </div>
                    <p className="mt-1.5 font-hand text-[1.05rem] leading-snug">{r.paper}</p>
                </div>
            ))}

            {/* Torn bottom edge. */}
            <svg
                aria-hidden="true"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="absolute -bottom-[11px] left-0 h-3 w-full"
            >
                <path d={TEAR_PATH} fill="#fbf6ea" />
            </svg>
        </div>
    );
}

/* ── Phone connector ──────────────────────────────────── */

function FlowConnector({ label }: { label: string }) {
    const reduce = useReducedMotion();
    return (
        <div className="relative flex flex-col items-center py-6 md:hidden" aria-hidden="true">
            <svg width="4" height="40" className="overflow-visible">
                <line x1="2" y1="0" x2="2" y2="40" className="story-dash" />
            </svg>
            <motion.span
                className="relative grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"
                animate={reduce ? undefined : { y: [0, 5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/40 motion-reduce:animate-none" />
                <ArrowDown size={22} className="relative" />
            </motion.span>
            <p className="mt-3 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-navy shadow-sm backdrop-blur-md">
                {label}
            </p>
            <svg width="4" height="28" className="mt-3 overflow-visible">
                <line x1="2" y1="0" x2="2" y2="28" className="story-dash" />
            </svg>
        </div>
    );
}

/* ── Whoply live ledger ───────────────────────────────── */

function WhoplyPanel({ c }: { c: Copy }) {
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const inView = useInView(box, { amount: 0.3 });
    // One row at a time "goes live" so the panel reads as a running ledger.
    const [live, setLive] = useState(0);
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (!inView || reduce || paused) return;
        const id = setInterval(() => setLive((k) => (k + 1) % c.rows.length), 2600);
        return () => clearInterval(id);
    }, [inView, reduce, paused, c.rows.length]);

    return (
        <div
            ref={box}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy pb-4 text-white shadow-2xl shadow-navy/30 md:grid md:grid-rows-subgrid md:[grid-row:span_var(--span)]"
        >
            {/* Ambient glow and mesh. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="mesh-blob mesh-a -top-24 -right-20 h-72 w-72 bg-success/40" />
                <div className="mesh-blob mesh-b -bottom-24 -left-16 h-72 w-72 bg-accent/35" />
                <div className="mesh-blob mesh-c top-1/3 left-1/3 h-56 w-56 bg-[#3b82f6]/20" />
                <div className="ledger-mesh absolute inset-0" />
            </div>

            <header className="relative px-6 pt-6 pb-4 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-display text-xl font-extrabold">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-success shadow-lg shadow-success/40">
                            <Smartphone size={18} aria-hidden="true" />
                        </span>
                        {c.app}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-400/30">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        {c.liveLabel}
                    </span>
                </div>
                <p className="mt-1 text-sm text-white/70">{c.appSub}</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#128C7E]/25 px-3 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-[#25D366]/30">
                    <MessageCircle size={16} aria-hidden="true" />
                    {c.autoSent} · 10:00
                </p>
            </header>

            {c.rows.map((r, i) => {
                const on = i === live;
                return (
                    <div key={r.topic} className="relative px-4 py-2.5 sm:px-6">
                        <motion.div
                            onPointerEnter={() => {
                                setPaused(true);
                                setLive(i);
                            }}
                            onPointerLeave={() => setPaused(false)}
                            animate={on ? { scale: 1.015 } : { scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            className={cn(
                                'h-full rounded-xl border px-4 py-3.5 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-500',
                                on
                                    ? 'border-emerald-400/50 bg-white/[0.1] shadow-[0_0_0_1px_rgb(52,211,153,0.25),0_12px_40px_-12px_rgb(16,185,129,0.55)]'
                                    : 'border-white/10 bg-white/[0.05]'
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-[11px] font-bold tracking-[0.14em] text-white/60 uppercase">{r.topic}</p>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/25 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-emerald-300 ring-1 ring-emerald-400/30">
                                    <CheckCircle2 size={12} aria-hidden="true" />
                                    {r.appTag}
                                </span>
                            </div>
                            <p className="mt-1.5 text-[0.95rem] leading-relaxed font-medium text-white/90">{r.app}</p>
                            <motion.p
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300"
                                animate={{ opacity: on ? 1 : 0.55 }}
                            >
                                <span className={cn('h-1.5 w-1.5 rounded-full bg-emerald-400', on && 'shadow-[0_0_8px_2px_rgb(52,211,153,0.8)]')} />
                                {c.live[i]}
                            </motion.p>
                        </motion.div>
                    </div>
                );
            })}
        </div>
    );
}
