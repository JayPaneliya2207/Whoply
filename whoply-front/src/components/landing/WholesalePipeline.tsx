'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
    AlertTriangle,
    Check,
    CheckCheck,
    ChevronDown,
    FileCheck2,
    Grid3x3,
    MapPin,
    PackageCheck,
    Route,
    Tags,
    Truck,
    UserRound,
    type LucideIcon,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';

const CYCLE_MS = 7000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/* Stage icons, and which of the eight `wholesalers.bullets` each stage covers. */
const STAGES: { Icon: LucideIcon; bullets: number[] }[] = [
    { Icon: Tags, bullets: [0] }, // price tiers
    { Icon: PackageCheck, bullets: [1, 2, 3, 7] }, // bulk orders, dispatch, e-way/e-invoice, warehouse
    { Icon: Route, bullets: [5, 6] }, // collect on route, team tracking
    { Icon: Grid3x3, bullets: [4] }, // outstanding & credit limits
];

const bulletTitle = (b: string) => {
    const i = b.indexOf(' — ');
    return i === -1 ? b : b.slice(0, i);
};

/**
 * Distribution as a four-stage B2B pipeline: price tiers → bulk orders &
 * dispatch → route & collection → credit matrix. A horizontal stepper picks
 * the stage; a dark canvas cross-fades a live mockup for it, with what the
 * stage covers beside it. Auto-steps while on screen until someone picks a
 * stage.
 */
export function WholesalePipeline({ lang, className }: { lang: Lang; className?: string }) {
    const w = getCopy(lang).wholesalers;
    const [active, setActive] = useState(0);
    const [auto, setAuto] = useState(true);
    const reduce = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const inView = useInView(box, { amount: 0.35 });
    const btns = useRef<(HTMLButtonElement | null)[]>([]);
    const uid = useId();
    const cycling = auto && inView && !reduce;

    useEffect(() => {
        if (!cycling) return;
        const id = setTimeout(() => setActive((a) => (a + 1) % STAGES.length), CYCLE_MS);
        return () => clearTimeout(id);
    }, [cycling, active]);

    const pick = (i: number) => {
        setAuto(false);
        setActive(i);
    };
    const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const j = (i + d + STAGES.length) % STAGES.length;
        pick(j);
        btns.current[j]?.focus();
    };

    const stage = w.stages[active];
    const mockups = [
        <PriceTiers key="tiers" lang={lang} />,
        <Dispatch key="dispatch" lang={lang} />,
        <RouteCollection key="route" lang={lang} />,
        <CreditMatrix key="credit" lang={lang} />,
    ];

    return (
        <div
            ref={box}
            className={cn(
                'relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 text-white shadow-2xl shadow-slate-900/30',
                className
            )}
        >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="mesh-blob mesh-a -top-32 -left-24 h-80 w-80 bg-accent/25" />
                <div className="mesh-blob mesh-b -right-24 -bottom-32 h-80 w-80 bg-[#3b82f6]/20" />
                <div className="ledger-mesh absolute inset-0" />
            </div>

            {/* ── Stage switcher ───────────────────────────────── */}
            <div className="relative border-b border-slate-800 p-4 sm:p-6">
                <div aria-hidden="true" className="absolute top-[2.85rem] right-[12.5%] left-[12.5%] hidden h-0.5 bg-slate-700 lg:block">
                    <motion.div
                        className="h-full bg-gradient-to-r from-accent-bright to-sand"
                        animate={{ width: `${(active / (STAGES.length - 1)) * 100}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                </div>
                <div role="tablist" aria-label={w.mock.tabsLabel} className="relative grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
                    {STAGES.map(({ Icon }, i) => {
                        const on = i === active;
                        const done = i < active;
                        return (
                            <button
                                key={i}
                                ref={(el) => {
                                    btns.current[i] = el;
                                }}
                                id={`${uid}-tab-${i}`}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                aria-controls={`${uid}-panel`}
                                tabIndex={on ? 0 : -1}
                                onClick={() => pick(i)}
                                onKeyDown={(e) => onKey(e, i)}
                                className={cn(
                                    'group relative overflow-hidden rounded-xl border p-3 text-left transition-[background-color,border-color] duration-300 lg:flex lg:flex-col lg:items-center lg:border-transparent lg:bg-transparent lg:text-center',
                                    on ? 'border-accent/60 bg-accent/15' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                                )}
                            >
                                <span className="flex items-center gap-2.5 lg:flex-col lg:gap-2">
                                    <span
                                        className={cn(
                                            'relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-300',
                                            on
                                                ? 'border-accent-bright bg-accent text-white shadow-[0_0_24px_4px_rgb(204,85,0,0.45)]'
                                                : done
                                                  ? 'border-sand/60 bg-slate-800 text-sand'
                                                  : 'border-slate-600 bg-slate-800 text-white/60 group-hover:border-slate-400 group-hover:text-white'
                                        )}
                                    >
                                        {done ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase">0{i + 1}</span>
                                        <span className={cn('block font-display text-sm leading-snug font-bold', on ? 'text-white' : 'text-white/75')}>
                                            {w.stages[i].title}
                                        </span>
                                    </span>
                                </span>
                                <span className={cn('mt-1 hidden text-xs leading-snug lg:block', on ? 'text-white/70' : 'text-white/45')}>
                                    {w.stages[i].sub}
                                </span>
                                {on && cycling && (
                                    <motion.span
                                        key={`p-${active}`}
                                        aria-hidden="true"
                                        className="absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-accent-bright"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Canvas: mockup left, what the stage covers right ── */}
            <div
                id={`${uid}-panel`}
                role="tabpanel"
                aria-labelledby={`${uid}-tab-${active}`}
                className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:p-8"
            >
                <div className="min-h-[21rem] rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4 shadow-inner sm:p-5">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {mockups[active]}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={active}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.3 }}
                        className="lg:self-center"
                    >
                        <p className="text-[11px] font-bold tracking-[0.14em] text-accent-bright uppercase">
                            0{active + 1} / 0{STAGES.length}
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-extrabold text-white">{stage.title}</h3>
                        <p className="mt-3 text-[0.98rem] leading-relaxed text-white/75">{stage.body}</p>
                        <ul className="mt-5 space-y-2">
                            {STAGES[active].bullets.map((b, k) => (
                                <motion.li
                                    key={b}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + k * 0.06 }}
                                    className="flex items-start gap-2.5 text-sm text-white/85"
                                >
                                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                                    </span>
                                    {bulletTitle(w.bullets[b])}
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

/* ── Shared bits ──────────────────────────────────────── */

function Panel({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('rounded-xl border border-slate-700/80 bg-slate-800/60 p-3', className)}>{children}</div>;
}

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ring-1',
                tone === 'ok' && 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
                tone === 'warn' && 'bg-orange-500/15 text-orange-300 ring-orange-400/30',
                tone === 'bad' && 'bg-red-500/15 text-red-300 ring-red-400/30'
            )}
        >
            {children}
        </span>
    );
}

/* ── 1 · Dealer price tiers, with a working dealer picker ── */

const TIERS: [string, number][] = [
    ['A', 95],
    ['B', 92],
    ['C', 90],
];
const DEALERS: [string, number][] = [
    ['Jain Traders', 1], // tier B
    ['Gupta Store', 0], // tier A
    ['Patel Mart', 2], // tier C
];
const CTN = 20;

function PriceTiers({ lang }: { lang: Lang }) {
    const w = getCopy(lang).wholesalers;
    const [dealer, setDealer] = useState(0);
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const listId = useId();
    const tier = DEALERS[dealer][1];
    const [tierName, price] = TIERS[tier];

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => {
            if (!wrap.current?.contains(e.target as Node)) setOpen(false);
        };
        const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    return (
        <div className="space-y-3">
            <div ref={wrap} className="relative">
                <p className="mb-1.5 text-[11px] font-semibold text-white/50">{w.pipe.dealer}</p>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => setOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent-bright/70"
                >
                    <span className="flex items-center gap-2">
                        <UserRound size={15} className="text-sand" aria-hidden="true" />
                        {DEALERS[dealer][0]}
                    </span>
                    <ChevronDown size={16} className={cn('text-white/60 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>
                <AnimatePresence>
                    {open && (
                        <motion.ul
                            id={listId}
                            role="listbox"
                            aria-label={w.pipe.dealer}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-2xl"
                        >
                            {DEALERS.map(([name, t], i) => (
                                <li key={name} role="option" aria-selected={i === dealer}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDealer(i);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-700',
                                            i === dealer ? 'text-white' : 'text-white/75'
                                        )}
                                    >
                                        {name}
                                        <span className="text-[11px] text-white/50">
                                            {w.mock.tier} {TIERS[t][0]}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>
            </div>

            <p className="text-xs font-semibold text-white/60">Parle-G 200g · 1 ctn</p>
            <ul className="space-y-2">
                {TIERS.map(([name, p], i) => {
                    const on = i === tier;
                    return (
                        <motion.li
                            key={name}
                            layout
                            className={cn(
                                'flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors duration-300',
                                on ? 'border-accent-bright/70 bg-accent/20 shadow-[0_0_20px_-4px_rgb(204,85,0,0.6)]' : 'border-slate-700 bg-slate-800/50'
                            )}
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                <span
                                    className={cn(
                                        'grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold',
                                        on ? 'bg-accent text-white' : 'bg-slate-700 text-white/70'
                                    )}
                                >
                                    {name}
                                </span>
                                <span className={on ? 'text-white' : 'text-white/60'}>
                                    {w.mock.tier} {name}
                                </span>
                            </span>
                            <span className={cn('tabular font-display text-lg font-extrabold', on ? 'text-white' : 'text-white/50')}>{inr(p)}</span>
                        </motion.li>
                    );
                })}
            </ul>

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={dealer}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/15 px-3 py-2.5 ring-1 ring-emerald-400/30"
                >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                        <CheckCheck size={14} aria-hidden="true" />
                        {w.pipe.applied(`${w.mock.tier} ${tierName}`, inr(price))}
                    </span>
                    <span className="tabular text-sm font-bold text-white">
                        {CTN} × {inr(price)} = {inr(CTN * price)}
                    </span>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

/* ── 2 · Bulk order to dispatch, stepping through live ── */

function Dispatch({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const p = t.wholesalers.pipe;
    const items = t.hero.mock.bill.wholesaleItems;
    const reduce = useReducedMotion();
    const [step, setStep] = useState(reduce ? 3 : 0);
    useEffect(() => {
        if (reduce || step >= 3) return;
        const id = setTimeout(() => setStep((s) => s + 1), 900);
        return () => clearTimeout(id);
    }, [step, reduce]);

    const steps: [string, string, string, LucideIcon][] = [
        [`${p.order} #4092`, 'Jain Traders', '10:02', PackageCheck],
        [p.ewb, 'EWB 3410 2291 8876', '10:05', FileCheck2],
        [p.driver, 'Suresh · GJ 01 AB 4521', '10:20', UserRound],
        [p.out, `${items.length} SKUs · 36 ctn`, '10:45', Truck],
    ];

    return (
        <div className="space-y-4">
            <ol className="relative space-y-3">
                <span aria-hidden="true" className="absolute top-4 bottom-4 left-[15px] w-0.5 bg-slate-700">
                    <motion.span
                        className="block h-full w-full origin-top bg-emerald-400"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: step / 3 }}
                        transition={{ duration: 0.5 }}
                    />
                </span>
                {steps.map(([label, detail, time, Icon], i) => {
                    const done = i <= step;
                    return (
                        <li key={label} className="relative flex items-center gap-3">
                            <span
                                className={cn(
                                    'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300',
                                    done ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600 bg-slate-800 text-white/40'
                                )}
                            >
                                {i === step && !reduce && step < 3 && (
                                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
                                )}
                                <Icon size={14} className="relative" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block text-sm font-semibold', done ? 'text-white' : 'text-white/40')}>{label}</span>
                                <span className="tabular block truncate text-[11px] text-white/50">{detail}</span>
                            </span>
                            <span className={cn('tabular text-[11px]', done ? 'text-emerald-300' : 'text-white/30')}>{time}</span>
                        </li>
                    );
                })}
            </ol>
            <Panel>
                <ul className="space-y-1.5 text-xs">
                    {items.map(([name, qty, amt]) => (
                        <li key={name} className="flex justify-between gap-2">
                            <span className="truncate text-white/80">
                                {name} <span className="text-white/45">{qty}</span>
                            </span>
                            <span className="tabular text-white">{inr(amt)}</span>
                        </li>
                    ))}
                </ul>
            </Panel>
        </div>
    );
}

/* ── 3 · Field agent on the route ─────────────────────── */

const STOPS: [number, number, boolean][] = [
    [12, 78, true],
    [30, 55, true],
    [48, 44, true],
    [66, 60, true],
    [84, 52, true],
    [84, 28, true],
    [70, 16, true],
    [50, 12, true],
    [30, 24, false],
];

/** One cubic Bézier per hop between stores; joined, a smooth Catmull-Rom curve through them. */
function hops(pts: [number, number][]): string[] {
    const out: string[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i - 1] ?? pts[i];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const [x3, y3] = pts[i + 2] ?? pts[i + 1];
        const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6];
        const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
        out.push(`M${x1} ${y1} C${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2} ${y2}`);
    }
    return out;
}
const ALL_HOPS = hops(STOPS.map(([x, y]) => [x, y]));
/* The whole route (dashed), and the hops already walked, up to the last visited store. */
const ROUTE = ALL_HOPS.join(' ');
const WALKED = ALL_HOPS.slice(0, STOPS.filter(([, , v]) => v).length - 1);
function RouteCollection({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const p = t.wholesalers.pipe;
    const reduce = useReducedMotion();
    return (
        <div className="space-y-3">
            {/* Agent badge */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent/15 px-3 py-2.5 ring-1 ring-accent-bright/40">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-extrabold text-white">R</span>
                <span className="text-sm font-bold text-white">{p.agent('Rahul')}</span>
                <span className="text-white/30">•</span>
                <span className="text-xs font-semibold text-white/80">{p.visited(8)}</span>
                <span className="text-white/30">•</span>
                <span className="text-xs font-bold text-emerald-300">{p.collected(inr(42000))}</span>
            </div>

            {/* Mini route map */}
            <div className="relative h-40 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/40">
                <div aria-hidden="true" className="ledger-mesh absolute inset-0 opacity-70 [mask-image:none]" />
                <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <path d={ROUTE} fill="none" stroke="rgb(148 163 184 / 0.35)" strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
{WALKED.map((seg, i) => (                        <motion.path                            key={i}                            d={seg}                            fill="none"                            stroke="var(--color-accent-bright)"                            strokeWidth="2"                            strokeLinecap="round"                            vectorEffect="non-scaling-stroke"                            initial={{ opacity: 0 }}                            animate={{ opacity: 1 }}                            transition={{ delay: reduce ? 0 : 0.25 + i * 0.22, duration: 0.25 }}                        />                    ))}
                </svg>
                {STOPS.map(([x, y, done], i) => (
                    <motion.span
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: reduce ? 0 : 0.2 + i * 0.2 }}
                        className={cn(
                            'absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2',
                            done ? 'bg-emerald-400 ring-emerald-400/30' : 'bg-slate-500 ring-slate-500/30'
                        )}
                        style={{ left: `${x}%`, top: `${(y / 90) * 100}%` }}
                    />
                ))}
                {/* The agent, at the last store visited — lands once the route has drawn. */}
                <motion.span
                    className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/40"
                    style={{ left: '50%', top: `${(12 / 90) * 100}%` }}
                    initial={{ scale: 0, y: -10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : 2, type: 'spring', stiffness: 400, damping: 16 }}
                >
                    <MapPin size={14} aria-hidden="true" />
                </motion.span>
            </div>

            <ul className="space-y-2">
                {(
                    [
                        ['Sharma General Store', 12000, 'UPI'],
                        ['Patel Mart', 8500, t.shopkeepers.mock.pay[0]],
                    ] as [string, number, string][]
                ).map(([name, amt, via]) => (
                    <li key={name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                            <span className="block truncate font-semibold text-white">{name}</span>
                            <span className="text-[11px] text-white/50">{via}</span>
                        </span>
                        <span className="tabular font-bold text-emerald-300">+{inr(amt)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── 4 · Outstanding credit matrix ────────────────────── */

function CreditMatrix({ lang }: { lang: Lang }) {
    const w = getCopy(lang).wholesalers;
    const p = w.pipe;
    const rows: [string, number, number][] = [
        ['Gupta Store', 84200, 100000],
        ['Jain Traders', 112000, 100000],
        ['Patel Mart', 23000, 75000],
        ['Sharma General Store', 41500, 60000],
    ];
    return (
        <div>
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-3 border-b border-slate-700 pb-2 text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">
                <span>{w.pipe.dealer}</span>
                <span>{p.outstanding}</span>
                <span className="text-right">{w.mock.limit}</span>
            </div>
            <ul>
                {rows.map(([name, used, limit], i) => {
                    const r = used / limit;
                    const tone = r > 1 ? 'bad' : r > 0.75 ? 'warn' : 'ok';
                    return (
                        <motion.li
                            key={name}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.06 * i }}
                            className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-800 py-2.5 transition-colors hover:bg-slate-800/60"
                        >
                            <span className="truncate text-sm font-semibold text-white">{name}</span>
                            <span>
                                <span className="tabular block text-sm font-bold text-white">{inr(used)}</span>
                                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-700">
                                    <motion.span
                                        className={cn(
                                            'block h-full rounded-full',
                                            tone === 'bad' ? 'bg-red-400' : tone === 'warn' ? 'bg-orange-400' : 'bg-emerald-400'
                                        )}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(r, 1) * 100}%` }}
                                        transition={{ duration: 0.8, delay: 0.1 + i * 0.08 }}
                                    />
                                </span>
                            </span>
                            <span className="text-right">
                                <span className="tabular block text-[11px] text-white/55">{inr(limit)}</span>
                                <span className="mt-1 inline-block">
                                    <Chip tone={tone}>
                                        {tone === 'bad' ? <AlertTriangle size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
                                        {tone === 'bad' ? p.hold : p.ok}
                                    </Chip>
                                </span>
                            </span>
                        </motion.li>
                    );
                })}
            </ul>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 ring-1 ring-red-400/30">
                <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                Jain Traders · {w.mock.onHold}
            </p>
        </div>
    );
}
