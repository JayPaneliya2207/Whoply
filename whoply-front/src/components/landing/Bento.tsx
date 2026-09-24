'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
    BarChart3,
    BellRing,
    Boxes,
    Check,
    CheckCheck,
    Lock,
    MessageCircle,
    ReceiptIndianRupee,
    Truck,
    Users,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { getCopy, HREF_LANG, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';
import { useReveal } from './Reveal';

/* Entrance: tiles rise and settle one after another. The 'hidden' step is
   instant (duration 0) — it only happens while the grid is still off-screen. */
const grid: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.08 } } };
const tile: Variants = {
    hidden: { opacity: 0, y: 60, scale: 0.95, transition: { duration: 0 } },
    shown: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120, damping: 18 } },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const d = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** One glass tile: header up top, its micro-UI pinned to the bottom so every tile lines up. */
function Tile({ Icon, title, body, children }: { Icon: LucideIcon; title: string; body: string; children: ReactNode }) {
    return (
        <motion.div
            variants={tile}
            className="glow-border flex h-full flex-col rounded-3xl border border-slate-300/70 bg-white/75 p-6 shadow-md ring-1 ring-white/60 ring-inset backdrop-blur-md transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/10"
        >
            <div className="flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent-strong">
                    <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h3 className="font-display text-lg leading-snug font-bold text-navy">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
            </div>
            <div className="mt-auto pt-6">{children}</div>
        </motion.div>
    );
}

/* ── Micro-UI ─────────────────────────────────────────── */

/** A bill writing itself, stamped GST-correct at the end (CSS loop). */
function MiniBill({ lang }: { lang: Lang }) {
    const m = getCopy(lang).hero.mock;
    const items = m.bill.retailItems;
    return (
        <div className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <ul className="space-y-1.5 text-xs">
                {items.map(([name, qty, amt], i) => (
                    <li key={name} className="bento-line flex justify-between gap-2" style={d(300 + i * 450)}>
                        <span className="truncate">
                            {name} <span className="text-muted">{qty}</span>
                        </span>
                        <span className="tabular">{inr(amt)}</span>
                    </li>
                ))}
            </ul>
            <div className="bento-line mt-2.5 flex items-center justify-between border-t border-dashed border-slate-300 pt-2" style={d(1700)}>
                <span className="text-xs text-muted">{m.bill.total}</span>
                <span className="tabular font-display text-lg font-extrabold text-navy">{inr(items.reduce((s, [, , a]) => s + a, 0))}</span>
            </div>
            <span
                className="bento-stamp absolute -top-3 -right-2 rounded-lg border-2 border-success bg-success-tint px-2 py-0.5 text-xs font-extrabold text-success"
                style={d(2100)}
            >
                GST ✓
            </span>
        </div>
    );
}

/** Stock levels draining and refilling, with the item that crossed its line called out. */
function StockLevels({ lang }: { lang: Lang }) {
    const m = getCopy(lang).hero.mock;
    const stock: [string, number, number][] = [
        [m.rows[0][0], 0.2, 5200],
        [m.rows[1][0], 0.5, 7400],
        [m.rows[2][0], 0.92, 6100],
    ];
    return (
        <div>
            <ul className="space-y-3">
                {stock.map(([name, level, ms], k) => (
                    <li key={name}>
                        <p className="text-xs font-medium text-text">{name}</p>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                            <div
                                className="bento-drain h-full origin-left rounded-full bg-success"
                                style={{ width: `${level * 100}%`, animationDuration: `${ms}ms`, animationDelay: `-${(k * ms) / 3}ms` }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-danger-tint px-3 py-2 text-xs font-semibold text-danger">
                <BellRing size={14} className="bento-ring shrink-0" aria-hidden="true" />
                {m.rows[0][0]} · {m.rows[0][1]}
            </p>
        </div>
    );
}

/** WhatsApp collection triggers: remind one customer, or everyone at once. */
function UdharReminders({ lang }: { lang: Lang }) {
    const ui = getCopy(lang).features.ui;
    const people: [string, number, number][] = [
        ['Ramesh Kirana', 12400, 3],
        ['Sunita Patel', 8250, 2],
        ['Mohan Lal', 3100, 1],
    ];
    const [sent, setSent] = useState<boolean[]>(people.map(() => false));
    const all = sent.every(Boolean);

    // Once everything has gone out, reset after a beat so the demo can be replayed.
    useEffect(() => {
        if (!all) return;
        const id = setTimeout(() => setSent(people.map(() => false)), 4500);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [all]);

    const send = (i: number) => setSent((s) => s.map((v, k) => (k === i ? true : v)));

    return (
        <div>
            <ul className="space-y-2">
                {people.map(([name, amt, age], i) => (
                    <li key={name} className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2">
                        <span className="flex gap-0.5" aria-hidden="true">
                            {[0, 1, 2].map((k) => (
                                <span key={k} className={cn('h-1.5 w-1.5 rounded-full', k < age ? 'bg-danger' : 'bg-border')} />
                            ))}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-navy">{name}</span>
                            <span className="tabular text-xs font-bold text-danger">{inr(amt)}</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => send(i)}
                            disabled={sent[i]}
                            aria-label={`${ui.remind}: ${name}`}
                            className={cn(
                                'inline-flex h-8 min-w-[4.75rem] items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors',
                                sent[i] ? 'bg-success-tint text-success' : 'bg-[#128C7E] text-white hover:bg-[#0e7266]'
                            )}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={sent[i] ? 's' : 'r'}
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    className="flex items-center gap-1"
                                >
                                    {sent[i] ? <CheckCheck size={13} aria-hidden="true" /> : <MessageCircle size={13} aria-hidden="true" />}
                                    {sent[i] ? ui.sent : ui.remind}
                                </motion.span>
                            </AnimatePresence>
                        </button>
                    </li>
                ))}
            </ul>
            <button
                type="button"
                onClick={() => setSent(people.map(() => true))}
                disabled={all}
                className={cn(
                    'mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors',
                    all ? 'border-success/30 bg-success-tint text-success' : 'border-[#25D366]/50 text-[#128C7E] hover:bg-[#25D366]/10'
                )}
            >
                {all ? <CheckCheck size={14} aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />}
                {all ? ui.allSent : ui.remindAll}
            </button>
        </div>
    );
}

/** A truck running the dispatch route (CSS loop). */
function DispatchRoute({ lang }: { lang: Lang }) {
    const steps = getCopy(lang).wholesalers.timeline.slice(0, 4);
    return (
        <div>
            <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
                <div className="bento-progress absolute inset-x-0 top-1/2 h-1 origin-left -translate-y-1/2 rounded-full bg-accent-bright" />
                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
                    {[0, 1, 2, 3].map((k) => (
                        <span key={k} className="h-3 w-3 rounded-full border-2 border-accent-bright bg-surface" />
                    ))}
                </div>
                <div className="bento-rail absolute inset-0">
                    <span className="absolute top-1/2 left-0 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-navy text-white shadow-md">
                        <Truck size={14} aria-hidden="true" />
                    </span>
                </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] leading-tight text-muted">
                {steps.map(([label], k) => (
                    <span key={label} className={k === 0 ? 'text-left' : k === 3 ? 'text-right' : 'text-center'}>
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Weekly sales where hovering, focusing or tapping a bar reads out that day. */
function SalesChart({ lang }: { lang: Lang }) {
    const ui = getCopy(lang).features.ui;
    const sales = [21400, 28900, 24300, 36100, 31800, 42600, 48250];
    const max = Math.max(...sales);
    // 1 Jan 2024 was a Monday: seven days of localised weekday names.
    const fmt = new Intl.DateTimeFormat(HREF_LANG[lang], { weekday: 'short' });
    const days = sales.map((_, i) => fmt.format(new Date(2024, 0, 1 + i)));
    const [on, setOn] = useState(sales.length - 1);

    return (
        <div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-[11px] text-muted">
                        {ui.sales} · {days[on]}
                    </p>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                            key={on}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="tabular font-display text-2xl font-extrabold text-navy"
                        >
                            {inr(sales[on])}
                        </motion.p>
                    </AnimatePresence>
                </div>
                <span className="text-[11px] text-muted">{ui.chartHint}</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5" onPointerLeave={() => setOn(sales.length - 1)}>
                {sales.map((v, i) => (
                    <button
                        key={i}
                        type="button"
                        aria-label={`${days[i]}: ${inr(v)}`}
                        aria-pressed={on === i}
                        onPointerEnter={() => setOn(i)}
                        onFocus={() => setOn(i)}
                        onClick={() => setOn(i)}
                        className="group relative flex h-full flex-1 items-end"
                    >
                        <span
                            className={cn(
                                'w-full rounded-t-md transition-colors duration-200',
                                on === i ? 'bg-accent' : 'bg-navy/15 group-hover:bg-navy/30'
                            )}
                            style={{ height: `${(v / max) * 100}%` }}
                        />
                    </button>
                ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
                {days.map((day, i) => (
                    <span key={i} className={cn('flex-1 truncate text-center text-[10px]', on === i ? 'font-bold text-accent-strong' : 'text-muted')}>
                        {day}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* Which permissions each role gets: billing, stock, reports, profit. */
const ACCESS: boolean[][] = [
    [true, true, true, true], // owner
    [true, true, true, false], // manager
    [true, false, false, false], // cashier
    [false, true, false, false], // warehouse
    [true, true, false, false], // sales
];

/** Pick a role; the permission badges flip to what that login can see. */
function StaffPermissions({ lang }: { lang: Lang }) {
    const ui = getCopy(lang).features.ui;
    const [role, setRole] = useState(2);
    return (
        <div>
            <p className="text-[11px] text-muted">{ui.seeAs}</p>
            <div role="radiogroup" aria-label={ui.seeAs} className="mt-2 flex flex-wrap gap-1.5">
                {ui.roles.map((r, i) => (
                    <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={role === i}
                        onClick={() => setRole(i)}
                        className={cn(
                            'relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                            role === i ? 'text-white' : 'bg-navy-tint text-navy hover:bg-navy/10'
                        )}
                    >
                        {role === i && (
                            <motion.span
                                layoutId="bento-role"
                                className="absolute inset-0 rounded-full bg-navy"
                                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                            />
                        )}
                        <span className="relative">{r}</span>
                    </button>
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                {ui.perms.map((p, k) => {
                    const ok = ACCESS[role][k];
                    return (
                        <motion.div
                            key={p}
                            layout
                            className={cn(
                                'flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors duration-300',
                                ok ? 'border-success/30 bg-success-tint text-success' : 'border-slate-200 bg-surface-2 text-muted'
                            )}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={ok ? 'y' : 'n'}
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    {ok ? <Check size={13} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}
                                </motion.span>
                            </AnimatePresence>
                            <span className={cn('truncate', !ok && 'line-through decoration-muted/50')}>{p}</span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Grid ─────────────────────────────────────────────── */

export function Bento({ lang }: { lang: Lang }) {
    const [c0, c1, c2, c3, c4, c5] = getCopy(lang).features.cards;
    const [ref, state] = useReveal<HTMLDivElement>(0.1);

    // CSS loops pause while the grid is off-screen — no work nobody sees.
    const [onScreen, setOnScreen] = useState(true);
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
        if (box.current) io.observe(box.current);
        return () => io.disconnect();
    }, []);

    return (
        <div ref={box} className={cn('bento', !onScreen && 'bento-paused')}>
            <motion.div
                ref={ref}
                variants={grid}
                initial={false}
                animate={state === 'hidden' ? 'hidden' : 'shown'}
                className="mt-14 grid gap-5 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3"
            >
                <Tile Icon={ReceiptIndianRupee} title={c0.title} body={c0.body}>
                    <MiniBill lang={lang} />
                </Tile>
                <Tile Icon={Boxes} title={c1.title} body={c1.body}>
                    <StockLevels lang={lang} />
                </Tile>
                <Tile Icon={Wallet} title={c2.title} body={c2.body}>
                    <UdharReminders lang={lang} />
                </Tile>
                <Tile Icon={Truck} title={c3.title} body={c3.body}>
                    <DispatchRoute lang={lang} />
                </Tile>
                <Tile Icon={BarChart3} title={c4.title} body={c4.body}>
                    <SalesChart lang={lang} />
                </Tile>
                <Tile Icon={Users} title={c5.title} body={c5.body}>
                    <StaffPermissions lang={lang} />
                </Tile>
            </motion.div>
        </div>
    );
}
