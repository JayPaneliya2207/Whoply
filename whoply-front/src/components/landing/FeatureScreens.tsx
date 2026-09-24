'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowDown,
    BellRing,
    CheckCheck,
    Undo2,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { cn } from '@/lib/cn';

/* Every screen in the retail tab mockups. Numbers and
   proper nouns are sample data; every label comes from the copy file. */

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type Tone = 'danger' | 'warning' | 'success' | 'navy';
const TONE_CHIP: Record<Tone, string> = {
    danger: 'bg-danger-tint text-danger',
    warning: 'bg-warning-tint text-warning',
    success: 'bg-success-tint text-success',
    navy: 'bg-navy-tint text-navy',
};
const TONE_BAR: Record<Tone, string> = {
    danger: 'bg-danger',
    warning: 'bg-warning',
    success: 'bg-success',
    navy: 'bg-navy',
};

function Chip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', TONE_CHIP[tone], className)}>
            {children}
        </span>
    );
}

/** A bar that grows to `value` (0..1) when the screen appears. */
function Bar({ value, tone, delay = 0 }: { value: number; tone: Tone; delay?: number }) {
    return (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
                className={cn('h-full origin-left rounded-full', TONE_BAR[tone])}
                style={{ width: `${Math.min(value, 1) * 100}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.15 + delay, ease: [0.16, 1, 0.3, 1] }}
            />
        </div>
    );
}

/** Rows that rise in one after another. */
function Rows({ children }: { children: ReactNode[] }) {
    return (
        <ul className="space-y-2.5">
            {children.map((c, i) => (
                <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.08 * i }}
                >
                    {c}
                </motion.li>
            ))}
        </ul>
    );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('rounded-xl border border-slate-200/80 bg-white px-3 py-2.5', className)}>{children}</div>;
}

function Big({ label, value, tone = 'navy' }: { label: string; value: string; tone?: Tone }) {
    return (
        <div>
            <p className="text-[11px] text-muted">{label}</p>
            <p className={cn('tabular font-display text-2xl font-extrabold', tone === 'navy' ? 'text-navy' : tone === 'success' ? 'text-success' : 'text-danger')}>
                {value}
            </p>
        </div>
    );
}

/* ── Retail ───────────────────────────────────────────── */

export function retailScreens(lang: Lang): ReactNode[] {
    const t = getCopy(lang);
    const m = t.shopkeepers.mock;
    const hm = t.hero.mock;
    const items = hm.bill.retailItems;
    const total = items.reduce((s, [, , a]) => s + a, 0);
    const split: [string, number, Tone][] = [
        [m.pay[0], 100, 'navy'],
        [m.pay[1], 94, 'success'],
        [m.pay[2], total - 194, 'warning'],
    ];

    return [
        // 0 · Billing with a split payment
        <div key="bill" className="space-y-4">
            <Rows>
                {items.map(([name, qty, amt]) => (
                    <Row key={name} className="flex items-center justify-between text-sm">
                        <span className="truncate text-text">
                            {name} <span className="text-muted">{qty}</span>
                        </span>
                        <span className="tabular font-semibold text-navy">{inr(amt)}</span>
                    </Row>
                ))}
            </Rows>
            <div className="flex items-end justify-between">
                <Big label={hm.bill.total} value={inr(total)} />
                <Chip tone="success">GST ✓</Chip>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full">
                {split.map(([k, v, tone], i) => (
                    <motion.span
                        key={k}
                        className={TONE_BAR[tone]}
                        style={{ width: `${(v / total) * 100}%` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.15 }}
                    />
                ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {split.map(([k, v, tone]) => (
                    <div key={k} className="rounded-lg bg-surface-2 px-2 py-1.5 text-center">
                        <p className="flex items-center justify-center gap-1 text-[11px] text-muted">
                            <span className={cn('h-1.5 w-1.5 rounded-full', TONE_BAR[tone])} />
                            {k}
                        </p>
                        <p className="tabular text-sm font-bold text-navy">{inr(v)}</p>
                    </div>
                ))}
            </div>
        </div>,

        // 1 · Batch-wise expiry
        <div key="expiry" className="space-y-3">
            <Rows>
                {(
                    [
                        ['Britannia Bread 400g', 'B-2302', 2, 'danger'],
                        ['Amul Butter 100g', 'B-2291', 7, 'warning'],
                        ['Parle-G 200g', 'B-2240', 21, 'success'],
                    ] as [string, string, number, Tone][]
                ).map(([name, batch, d, tone], i) => (
                    <Row key={batch}>
                        <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-navy">{name}</p>
                            <Chip tone={tone}>{m.expiresIn(d)}</Chip>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                            {m.batch} {batch}
                        </p>
                        <div className="mt-2">
                            <Bar value={1 - d / 30} tone={tone} delay={i * 0.1} />
                        </div>
                    </Row>
                ))}
            </Rows>
            <div className="flex items-center gap-2 rounded-xl bg-danger-tint px-3 py-2.5 text-sm font-semibold text-danger">
                <BellRing size={16} className="bento-ring shrink-0" aria-hidden="true" />
                Britannia Bread · {m.expiresIn(2)}
            </div>
        </div>,

        // 2 · Udhar with aging
        <div key="udhar" className="space-y-3">
            <Big label={hm.retailTiles[3][0]} value={hm.retailTiles[3][1]} tone="danger" />
            <Rows>
                {(
                    [
                        ['Ramesh Kirana', 12400, 64, 'danger'],
                        ['Sunita Patel', 8250, 38, 'warning'],
                        ['Mohan Lal', 3100, 9, 'success'],
                    ] as [string, number, number, Tone][]
                ).map(([name, amt, d, tone], i) => (
                    <Row key={name}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-semibold text-navy">{name}</span>
                            <span className="tabular font-bold text-navy">{inr(amt)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1">
                                <Bar value={d / 70} tone={tone} delay={i * 0.1} />
                            </div>
                            <span className={cn('text-[11px] font-semibold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-muted')}>
                                {m.days(d)}
                            </span>
                        </div>
                    </Row>
                ))}
            </Rows>
            <p className="flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-semibold text-white">
                <CheckCheck size={14} aria-hidden="true" /> 10:00 · {hm.reminder}
            </p>
        </div>,

        // 3 · Reorder from real sales speed
        <div key="reorder" className="space-y-3">
            <Rows>
                {t.reorder.rows.map(([name, cover, order], i) => {
                    const tone: Tone = i === 0 ? 'danger' : i === 1 ? 'warning' : 'success';
                    const days = Number(cover.match(/\d+/)?.[0] ?? 30);
                    return (
                        <Row key={name}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate font-semibold text-navy">{name}</span>
                                <Chip tone={tone}>{order}</Chip>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">{cover}</p>
                            <div className="mt-2">
                                <Bar value={days / 31} tone={tone} delay={i * 0.1} />
                            </div>
                        </Row>
                    );
                })}
            </Rows>
            <p className="text-[11px] leading-relaxed text-muted">{t.reorder.foot}</p>
        </div>,

        // 4 · Profit tonight
        <div key="profit" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Row>
                    <Big label={hm.retailTiles[0][0]} value={hm.retailTiles[0][1]} />
                </Row>
                <Row className="border-success/30 bg-success-tint">
                    <Big label={hm.retailTiles[2][0]} value={hm.retailTiles[2][1]} tone="success" />
                </Row>
            </div>
            <div className="flex h-32 items-end gap-2 rounded-xl bg-surface-2 p-3">
                {[0.42, 0.55, 0.38, 0.7, 0.62, 0.84, 1].map((h, i) => (
                    <motion.span
                        key={i}
                        className={cn('flex-1 origin-bottom rounded-t-md', i === 6 ? 'bg-success' : 'bg-navy/15')}
                        style={{ height: `${h * 100}%` }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    />
                ))}
            </div>
        </div>,

        // 5 · Quotation → invoice
        <div key="quote" className="flex flex-col items-center gap-2">
            <Row className="w-full">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy">{m.quote} · QT-118</span>
                    <span className="tabular text-sm font-bold text-muted">{inr(18450)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">Patel Caterers</p>
            </Row>
            <motion.span
                className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
            >
                <ArrowDown size={16} aria-hidden="true" />
            </motion.span>
            <motion.div
                className="w-full"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 20 }}
            >
                <Row className="border-success/40 shadow-md">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-navy">{m.invoice} · INV-2041</span>
                        <span className="tabular text-sm font-bold text-navy">{inr(18450)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">Patel Caterers · GST 5%</p>
                </Row>
            </motion.div>
            <Chip tone="success" className="mt-1">
                <CheckCheck size={12} aria-hidden="true" /> {m.convert}
            </Chip>
        </div>,

        // 6 · Returns and damage as a credit note
        <div key="returns" className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-navy">
                    <Undo2 size={16} aria-hidden="true" /> {m.creditNote} · CN-031
                </span>
            </div>
            <Rows>
                {(
                    [
                        ['Amul Butter 100g ×2', m.returned, 116, 'warning'],
                        ['Eggs tray ×1', m.damaged, 84, 'danger'],
                    ] as [string, string, number, Tone][]
                ).map(([name, kind, amt, tone]) => (
                    <Row key={name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                            <span className="block truncate font-semibold text-navy">{name}</span>
                            <Chip tone={tone} className="mt-1">
                                {kind}
                            </Chip>
                        </span>
                        <span className="tabular font-bold text-danger">−{inr(amt)}</span>
                    </Row>
                ))}
            </Rows>
            <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-3">
                <span className="text-xs text-muted">{hm.bill.total}</span>
                <span className="tabular font-display text-xl font-extrabold text-danger">−{inr(200)}</span>
            </div>
        </div>,

        // 7 · Suppliers and what you owe
        <div key="suppliers" className="space-y-3">
            <Rows>
                {(
                    [
                        ['Hindustan Unilever', 'PO-77', true, 18400],
                        ['ITC Ltd', 'PO-78', false, 9650],
                        ['Parle Agro', 'PO-79', false, 6200],
                    ] as [string, string, boolean, number][]
                ).map(([name, po, got, amt]) => (
                    <Row key={po} className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-navy">{name}</span>
                            <span className="text-[11px] text-muted">
                                {m.po} · {po}
                            </span>
                        </span>
                        <span className="text-right">
                            <span className="tabular block text-sm font-bold text-navy">{inr(amt)}</span>
                            <Chip tone={got ? 'success' : 'warning'}>{got ? m.received : m.pending}</Chip>
                        </span>
                    </Row>
                ))}
            </Rows>
            <div className="flex items-center justify-between rounded-xl bg-navy px-3 py-2.5 text-white">
                <span className="text-xs text-white/80">{m.youOwe}</span>
                <span className="tabular font-display text-lg font-extrabold">{inr(15850)}</span>
            </div>
        </div>,
    ];
}

/* ── Retail, grouped into four tabs ───────────────────── */

/** Expiry and reorder on one screen: what's about to spoil, and what to order. */
function StockAlerts({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const m = t.shopkeepers.mock;
    return (
        <div className="space-y-3">
            <Rows>
                {(
                    [
                        ['Britannia Bread 400g', 'B-2302', 2, 'danger'],
                        ['Amul Butter 100g', 'B-2291', 7, 'warning'],
                    ] as [string, string, number, Tone][]
                ).map(([name, batch, d, tone], i) => (
                    <Row key={batch}>
                        <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-navy">{name}</p>
                            <Chip tone={tone}>{m.expiresIn(d)}</Chip>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                            {m.batch} {batch}
                        </p>
                        <div className="mt-2">
                            <Bar value={1 - d / 30} tone={tone} delay={i * 0.1} />
                        </div>
                    </Row>
                ))}
            </Rows>
            <div className="rounded-xl border border-accent/25 bg-accent-tint p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-accent-strong uppercase">
                    <BellRing size={13} className="bento-ring" aria-hidden="true" /> {t.reorder.eyebrow}
                </p>
                <ul className="mt-2 space-y-1.5">
                    {t.reorder.rows.slice(0, 2).map(([name, cover, order], i) => (
                        <li key={name} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0">
                                <span className="block truncate font-semibold text-navy">{name}</span>
                                <span className="text-[11px] text-muted">{cover}</span>
                            </span>
                            <Chip tone={i === 0 ? 'danger' : 'warning'}>{order}</Chip>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/** Screens for the four retail groups: GST bill, stock alerts, udhar, supplier POs. */
export function retailGroupScreens(lang: Lang): ReactNode[] {
    const r = retailScreens(lang);
    return [r[0], <StockAlerts key="stock" lang={lang} />, r[2], r[7]];
}
