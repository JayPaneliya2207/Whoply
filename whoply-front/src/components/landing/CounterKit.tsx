'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
    CheckCheck,
    MessageCircle,
    MousePointerClick,
    Printer,
    QrCode,
    ScanBarcode,
    Send,
    TabletSmartphone,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { MEDIA } from '@/lib/media';
import { cn } from '@/lib/cn';
import { SpotDot, SpotProgress, spotVars, useSpotCycle, type Spot } from './Hotspots';

/** Positions on `wigets.png`, in the order of `shopkeepers.kit.items`. */
const SPOTS: Spot[] = [
    { x: 32.5, y: 43, fx: 19, fy: 57, w: 25, h: 26 }, // billing tablet
    { x: 46.9, y: 65, fx: 46.9, fy: 56.5, w: 11.5, h: 21 }, // thermal printer
    { x: 65.6, y: 29, fx: 65.4, fy: 24.6, w: 8.5, h: 19 }, // barcode scanner
    { x: 86, y: 70, fx: 91, fy: 81, w: 10.5, h: 19.5 }, // UPI stand
];
const ICONS: LucideIcon[] = [TabletSmartphone, Printer, ScanBarcode, QrCode];
/** How far the photo zooms toward each device when it's picked. */
const ZOOM = [1.25, 1.55, 1.6, 1.5];

/* Metric cards, in the order of `shopkeepers.stats`, and the device each one
   is wired to: printer → bill time, scanner → batch expiry, UPI → udhar,
   tablet → day close. */
const CARD_DEVICE = [1, 2, 3, 0];
const deviceCard = (d: number) => CARD_DEVICE.indexOf(d);

/**
 * The counter hardware and what each piece does for you, as one connected
 * component. Pick a device (dot, pill, or its metric card) and the photo
 * zooms onto it under a soft spotlight, its metric card lights up, and on
 * desktop a glowing link runs from the device to the card.
 */
export function CounterKit({ lang }: { lang: Lang }) {
    const t = getCopy(lang).shopkeepers;
    const kit = t.kit;
    const { box, active, pick, cycling, interval } = useSpotCycle(SPOTS.length);
    const reduce = useReducedMotion();
    const spot = SPOTS[active];
    const scale = active >= 0 && !reduce ? ZOOM[active] : 1;

    // ── Beam geometry (desktop): device point on the zoomed photo → card edge.
    const root = useRef<HTMLDivElement>(null);
    const photo = useRef<HTMLDivElement>(null);
    const cards = useRef<(HTMLDivElement | null)[]>([]);
    const [beam, setBeam] = useState<{ d: string; a: [number, number]; b: [number, number] } | null>(null);

    const measure = useCallback(() => {
        const r = root.current?.getBoundingClientRect();
        const p = photo.current?.getBoundingClientRect();
        const card = active >= 0 ? cards.current[deviceCard(active)]?.getBoundingClientRect() : undefined;
        if (!r || !p || !card || !spot || window.innerWidth < 1024) return setBeam(null);
        // Where the dot lands once the photo has scaled about the spotlight centre.
        const ox = spot.fx ?? spot.x;
        const oy = spot.fy ?? spot.y;
        const x = ox + (spot.x - ox) * scale;
        const y = oy + (spot.y - oy) * scale;
        const ax = p.left - r.left + (p.width * Math.min(Math.max(x, 4), 96)) / 100;
        const ay = p.top - r.top + (p.height * Math.min(Math.max(y, 6), 94)) / 100;
        const bx = card.left - r.left;
        const by = card.top - r.top + card.height / 2;
        const mid = (ax + bx) / 2;
        setBeam({ d: `M${ax},${ay} C${mid},${ay} ${mid},${by} ${bx},${by}`, a: [ax, ay], b: [bx, by] });
    }, [active, scale, spot]);

    useLayoutEffect(() => {
        measure();
    }, [measure]);
    useEffect(() => {
        const ro = new ResizeObserver(measure);
        if (root.current) ro.observe(root.current);
        return () => {
            ro.disconnect();
        };
    }, [measure]);

    return (
        <div ref={root} className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
            {/* ── Hardware photo ───────────────────────────────── */}
            <div ref={box} className="overflow-hidden rounded-3xl border border-slate-300/70 bg-white shadow-2xl shadow-slate-900/10">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                    <p className="eyebrow !text-navy">{kit.label}</p>
                    <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
                        <MousePointerClick size={14} className="mr-1 text-accent-strong" />
                        {SPOTS.map((_, i) => (
                            <span
                                key={i}
                                className={cn('h-1.5 rounded-full transition-all duration-300', i === active ? 'w-5 bg-accent-bright' : 'w-1.5 bg-border')}
                            />
                        ))}
                    </span>
                </div>

                <div ref={photo} className="relative overflow-hidden bg-bg">
                    <motion.div
                        className="spot-stage relative"
                        style={{ ...spotVars(spot, 0.3), transformOrigin: spot ? `${spot.fx ?? spot.x}% ${spot.fy ?? spot.y}%` : '50% 50%' }}
                        animate={{ scale }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Image
                            src={MEDIA.counterKit.src}
                            alt={MEDIA.counterKit.alt[lang]}
                            width={MEDIA.counterKit.width}
                            height={MEDIA.counterKit.height}
                            sizes="(max-width: 1024px) 100vw, 700px"
                            className="spot-mask h-auto w-full"
                        />
                        {SPOTS.map((s, i) => (
                            <SpotDot key={i} spot={s} active={i === active} onSelect={() => pick(i)} />
                        ))}
                    </motion.div>
                    {/* Soft vignette so the zoomed device reads as the subject. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgb(15,43,70,0.12)]" />
                </div>

                <div className="border-t border-slate-200 p-4 sm:p-5">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {kit.items.map((it, i) => {
                            const Icon = ICONS[i];
                            const on = i === active;
                            return (
                                <button
                                    key={it.title}
                                    type="button"
                                    aria-pressed={on}
                                    aria-controls="counter-kit-detail"
                                    onClick={() => pick(i)}
                                    onPointerEnter={(e) => e.pointerType === 'mouse' && pick(i)}
                                    className={cn(
                                        'relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-[0.8rem] font-semibold transition-[border-color,color,box-shadow,transform] duration-200',
                                        on
                                            ? 'border-navy text-white shadow-lg shadow-navy/25'
                                            : 'border-slate-200 bg-white text-navy hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md'
                                    )}
                                >
                                    {on && (
                                        <motion.span
                                            layoutId="kit-pill"
                                            className="absolute inset-0 bg-navy"
                                            transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                                        />
                                    )}
                                    <Icon size={16} aria-hidden="true" className={cn('relative', on ? 'text-sand' : 'text-accent-strong')} />
                                    <span className="relative leading-tight">{it.title}</span>
                                    {on && cycling && (
                                        <SpotProgress key={active} ms={interval} className="absolute inset-x-0 bottom-0 rounded-none" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div id="counter-kit-detail" className="mt-3 min-h-[3rem]">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.p
                                key={active}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.25 }}
                                className={cn('text-[0.95rem] leading-relaxed', spot ? 'text-text' : 'text-muted')}
                            >
                                {spot ? kit.items[active].body : kit.hint}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ── Metric cards, each wired to a device ─────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3">
                {t.stats.map(([label, value], k) => {
                    const dev = CARD_DEVICE[k];
                    const on = active === dev;
                    const Icon = ICONS[dev];
                    return (
                        <div
                            key={label}
                            ref={(el) => {
                                cards.current[k] = el;
                            }}
                            onClick={() => pick(dev)}
                            onPointerEnter={(e) => e.pointerType === 'mouse' && pick(dev)}
                            className={cn(
                                'relative flex cursor-pointer flex-col rounded-2xl border bg-white/85 p-4 lg:flex-row lg:items-center lg:gap-4 backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300',
                                on
                                    ? 'border-accent/60 shadow-xl shadow-accent/15 ring-4 ring-accent/10 lg:-translate-x-1'
                                    : 'border-slate-300/70 shadow-md hover:border-slate-400/70'
                            )}
                        >
                            <div className="lg:w-[44%] lg:shrink-0">
                                <span
                                    className={cn(
                                        'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
                                        on ? 'bg-navy text-white' : 'bg-navy-tint text-navy'
                                    )}
                                >
                                    <Icon size={12} aria-hidden="true" className={on ? 'text-sand' : 'text-accent-strong'} />
                                    {kit.items[dev].title}
                                </span>
                                <p className="mt-3 text-xs text-muted">{label}</p>
                                <p className="font-display text-lg leading-tight font-extrabold text-navy">{value}</p>
                            </div>
                            <div className="mt-3 flex-1 lg:mt-0">
                                <Metric k={k} lang={lang} on={on} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── The link from device to card (desktop) ───────── */}
            {beam && (
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible lg:block">
                    <motion.path
                        key={`${active}-glow`}
                        d={beam.d}
                        fill="none"
                        stroke="rgb(204 85 0 / 0.25)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
                    />
                    <motion.path
                        key={`${active}-line`}
                        d={beam.d}
                        fill="none"
                        className="kit-beam"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                    />
                    {[beam.a, beam.b].map(([x, y], i) => (
                        <motion.circle
                            key={`${active}-${i}`}
                            cx={x}
                            cy={y}
                            r="5"
                            fill="var(--color-accent-bright)"
                            stroke="white"
                            strokeWidth="2.5"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.45 + i * 0.5, type: 'spring', stiffness: 400, damping: 18 }}
                        />
                    ))}
                </svg>
            )}
        </div>
    );
}

/* ── Micro-UI inside each metric card ─────────────────── */

function Metric({ k, lang, on }: { k: number; lang: Lang; on: boolean }) {
    const m = getCopy(lang).shopkeepers.metrics;
    if (k === 0) return <BillTimer label={m.avg} on={on} />;
    if (k === 1) return <BatchTags make={m.batch} on={on} />;
    if (k === 2) return <DebtTag due={m.due('₹1,200')} reminded={m.reminded} on={on} />;
    return <DayClose send={m.send} sent={m.sent} on={on} />;
}

/** A ring that fills to 8 of 10 seconds whenever it comes into view or its card lights up. */
function BillTimer({ label, on }: { label: string; on: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const seen = useInView(ref, { once: true, amount: 0.6 });
    const [run, setRun] = useState(0);
    useEffect(() => {
        if (on) setRun((r) => r + 1);
    }, [on]);
    const R = 18;
    const C = 2 * Math.PI * R;
    return (
        <div ref={ref} className="flex items-center gap-3">
            <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90" aria-hidden="true">
                <circle cx="22" cy="22" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
                <motion.circle
                    key={run}
                    cx="22"
                    cy="22"
                    r={R}
                    fill="none"
                    stroke="var(--color-accent-bright)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    initial={{ strokeDashoffset: C }}
                    animate={{ strokeDashoffset: seen ? C * (1 - 0.8) : C }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
            </svg>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-bold text-accent-strong">
                <Zap size={13} className="fill-current" aria-hidden="true" />
                {label}
            </span>
        </div>
    );
}

/** Colour-coded batch tags, nearest expiry highlighted. */
function BatchTags({ make, on }: { make: (n: number, exp: string) => string; on: boolean }) {
    const tags: [number, string, string][] = [
        [78, '10/26', 'border-warning/40 bg-warning-tint text-warning'],
        [81, '03/27', 'border-success/40 bg-success-tint text-success'],
        [64, '09/26', 'border-danger/40 bg-danger-tint text-danger'],
    ];
    return (
        <ul className="space-y-1.5">
            {tags.map(([n, exp, tone], i) => (
                <motion.li
                    key={n}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                    className={cn(
                        'w-fit rounded-md border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap',
                        tone,
                        on && i === 2 && 'animate-pulse'
                    )}
                >
                    {make(n, exp)}
                </motion.li>
            ))}
        </ul>
    );
}

/** A ledger line with its reminder already out. */
function DebtTag({ due, reminded, on }: { due: string; reminded: string; on: boolean }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-danger/25 bg-danger-tint px-2.5 py-1.5">
                <span className="text-xs font-bold text-danger">{due}</span>
                <span className="flex gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full bg-danger" />
                    ))}
                </span>
            </div>
            <motion.span
                animate={on ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-1 rounded-full bg-[#128C7E] px-2.5 py-1 text-[11px] font-bold text-white"
            >
                <MessageCircle size={12} aria-hidden="true" />
                {reminded}
                <CheckCheck size={12} aria-hidden="true" />
            </motion.span>
        </div>
    );
}

/** One tap closes the day and sends the summary. */
function DayClose({ send, sent, on }: { send: string; sent: string; on: boolean }) {
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!done) return;
        const id = setTimeout(() => setDone(false), 4000);
        return () => clearTimeout(id);
    }, [done]);
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                setDone(true);
            }}
            className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold transition-colors',
                done ? 'bg-success text-white' : on ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-navy text-white hover:bg-navy-light'
            )}
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={String(done)}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5"
                >
                    {done ? <CheckCheck size={14} aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
                    {done ? sent : send}
                </motion.span>
            </AnimatePresence>
        </button>
    );
}

