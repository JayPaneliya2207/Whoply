'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { CheckCheck, FileCheck2, FileSpreadsheet, Loader2, ReceiptText, Send, Truck, type LucideIcon } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';

const STEP_MS = 1100;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* A QR-looking 21×21 grid: three finder squares plus fixed pseudo-random
   modules (seeded, so server and client agree). Decorative only. */
const QR = (() => {
    const size = 21;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const finder = (x: number, y: number, ox: number, oy: number) => {
        const dx = x - ox, dy = y - oy;
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        return ring !== 2;
    };
    const cells: [number, number][] = [];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const f = finder(x, y, 0, 0) ?? finder(x, y, 14, 0) ?? finder(x, y, 0, 14);
            const inQuiet = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
            if (f === true || (f === null && !inQuiet && rnd() > 0.52)) cells.push([x, y]);
        }
    return cells;
})();

function QrThumb() {
    return (
        <svg viewBox="-1 -1 23 23" className="h-14 w-14 shrink-0 rounded-md bg-white p-0.5" aria-hidden="true">
            {QR.map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f2b46" />
            ))}
        </svg>
    );
}

function Tag({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-emerald-300 ring-1 ring-emerald-400/30">
            <CheckCheck size={12} aria-hidden="true" />
            {children}
        </span>
    );
}

/** The dark micro-card under each node. */
function Mini({ children, lit }: { children: ReactNode; lit: boolean }) {
    return (
        <div
            className={cn(
                'mt-4 rounded-xl border bg-white/[0.04] p-3.5 transition-[border-color,box-shadow,background-color] duration-500',
                lit ? 'border-emerald-400/40 bg-white/[0.07] shadow-[0_10px_30px_-12px_rgb(16,185,129,0.5)]' : 'border-white/10'
            )}
        >
            {children}
        </div>
    );
}

/**
 * The GST work as one auto-filing pipeline: E-invoice → E-way bill → GSTR
 * reports → Tally export, joined by a flowing dashed line. While the pipeline
 * is on screen a light pulse walks node to node and each node lights up as it
 * arrives; hovering speeds the flow. Horizontal from lg, vertical below.
 */
export function CompliancePipeline({ lang }: { lang: Lang }) {
    const c = getCopy(lang).compliance;
    const p = c.pipe;
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const inView = useInView(box, { amount: 0.35 });
    const [hover, setHover] = useState(false);
    const [step, setStep] = useState(reduce ? 3 : 0);

    useEffect(() => {
        if (!inView || reduce) return;
        const id = setInterval(() => setStep((s) => (s + 1) % 4), hover ? STEP_MS / 2 : STEP_MS);
        return () => clearInterval(id);
    }, [inView, reduce, hover]);

    // Tally node: idle → exporting → sent. Plays itself the first time the pulse arrives.
    const [exp, setExp] = useState<'idle' | 'busy' | 'sent'>('idle');
    const played = useRef(false);
    const runExport = () => {
        if (exp === 'busy') return;
        setExp('busy');
        setTimeout(() => setExp('sent'), 900);
    };
    useEffect(() => {
        if (step === 3 && !played.current) {
            played.current = true;
            runExport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);
    useEffect(() => {
        if (exp !== 'sent') return;
        const id = setTimeout(() => setExp('idle'), 5000);
        return () => clearTimeout(id);
    }, [exp]);

    const icons: LucideIcon[] = [FileCheck2, Truck, ReceiptText, FileSpreadsheet];
    const lit = (i: number) => (reduce ? true : i <= step);
    const pct = (step / 3) * 100;

    const visuals: ReactNode[] = [
        // E-invoice
        <Mini key="irn" lit={lit(0)}>
            <div className="flex items-center gap-3">
                <QrThumb />
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">INV-2041</p>
                    <p className="tabular text-sm font-bold text-white/90">{inr(84200)}</p>
                    <p className="tabular mt-0.5 truncate text-[10px] text-white/50">IRN a3f9…5c21e</p>
                </div>
            </div>
            <div className="mt-3">
                <Tag>{p.irn}</Tag>
            </div>
        </Mini>,
        // E-way bill
        <Mini key="ewb" lit={lit(1)}>
            <p className="tabular text-xs font-semibold text-white">EWB 3410 2291 8876</p>
            <p className="mt-1 text-[11px] text-white/60">
                {p.vehicle} · <span className="tabular text-white/85">GJ 01 AB 4521</span>
            </p>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                    initial={{ width: '10%' }}
                    animate={{ width: lit(1) ? '100%' : '10%' }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
            </div>
            <div className="mt-3">
                <Tag>{p.cleared}</Tag>
            </div>
        </Mini>,
        // GSTR breakdown
        <Mini key="gstr" lit={lit(2)}>
            <div className="flex justify-between text-[11px] text-white/60">
                <span>{p.taxable}</span>
                <span className="tabular text-white/85">{inr(10000)}</span>
            </div>
            <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2 text-xs">
                {[
                    ['CGST 9%', 900],
                    ['SGST 9%', 900],
                ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                        <span className="text-white/80">{k}</span>
                        <span className="tabular font-bold text-emerald-300">{inr(v as number)}</span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-dashed border-white/15 pt-2 text-xs font-bold text-white">
                <span>GST</span>
                <span className="tabular">{inr(1800)}</span>
            </div>
        </Mini>,
        // Tally export
        <Mini key="tally" lit={lit(3)}>
            <button
                type="button"
                onClick={runExport}
                disabled={exp === 'busy'}
                className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors',
                    exp === 'sent' ? 'bg-success text-white' : 'bg-accent text-white hover:bg-accent-hover'
                )}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={exp}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-2"
                    >
                        {exp === 'busy' ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : exp === 'sent' ? (
                            <CheckCheck size={14} aria-hidden="true" />
                        ) : (
                            <FileSpreadsheet size={14} aria-hidden="true" />
                        )}
                        {exp === 'busy' ? p.exporting : exp === 'sent' ? p.sent : p.exportBtn}
                    </motion.span>
                </AnimatePresence>
            </button>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
                <motion.span
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/10"
                    animate={exp === 'sent' ? { scale: [1, 1.25, 1], backgroundColor: 'rgb(16 185 129 / 0.35)' } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <Send size={12} className={exp === 'sent' ? 'text-emerald-300' : 'text-white/60'} aria-hidden="true" />
                </motion.span>
                <span className={cn('font-semibold', exp === 'sent' && 'text-emerald-300')}>{p.sent}</span>
                <AnimatePresence>
                    {exp === 'sent' && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-emerald-300">
                            <CheckCheck size={14} aria-hidden="true" />
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </Mini>,
    ];

    return (
        <div
            ref={box}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            className="relative mt-14 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8"
        >
            <div aria-hidden="true" className="ledger-mesh pointer-events-none absolute inset-0" />

            <div className="relative">
                {/* Connector: horizontal through the node icons from lg, vertical on the left below. */}
                <div aria-hidden="true" className="pointer-events-none absolute top-5 bottom-5 left-5 w-0.5 lg:top-5 lg:right-[12.5%] lg:bottom-auto lg:left-[12.5%] lg:h-0.5 lg:w-auto">
                    <div className={cn('pipe-dash absolute inset-0', hover && 'pipe-dash-fast')} />
                    <motion.div
                        className="absolute inset-y-0 left-0 hidden bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-emerald-400 lg:block"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.div
                        className="absolute inset-x-0 top-0 bg-gradient-to-b from-emerald-400/0 via-emerald-400/70 to-emerald-400 lg:hidden"
                        animate={{ height: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {/* The light pulse riding the line. */}
                    <motion.span
                        className="absolute top-1/2 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_16px_6px_rgb(52,211,153,0.6)] lg:block"
                        animate={{ left: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                        className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_16px_6px_rgb(52,211,153,0.6)] lg:hidden"
                        animate={{ top: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                </div>

                <ol className="relative grid gap-8 lg:grid-cols-4 lg:gap-6">
                    {c.cards.map((card, i) => {
                        const Icon = icons[i];
                        const on = lit(i);
                        const here = !reduce && i === step;
                        return (
                            <li key={card.title} className="relative pl-16 lg:pl-0 lg:text-center">
                                <div className="absolute top-0 left-0 lg:static lg:flex lg:justify-center">
                                    <span
                                        className={cn(
                                            'relative grid h-10 w-10 place-items-center rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-500',
                                            on
                                                ? 'border-emerald-400 bg-emerald-500 text-white shadow-[0_0_24px_4px_rgb(16,185,129,0.45)]'
                                                : 'border-slate-600 bg-slate-800 text-white/60'
                                        )}
                                    >
                                        {here && (
                                            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50 motion-reduce:animate-none" />
                                        )}
                                        <Icon size={17} className="relative" aria-hidden="true" />
                                    </span>
                                </div>
                                <div className="lg:mt-4">
                                    <p className="text-[11px] font-bold tracking-[0.14em] text-white/40 uppercase">0{i + 1}</p>
                                    <h3 className="mt-0.5 font-display text-lg font-bold text-white">{card.title}</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-white/60">{card.body}</p>
                                    <div className="text-left">{visuals[i]}</div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
