'use client';

import Image from 'next/image';
import { Fragment, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
    AnimatePresence,
    MotionConfig,
    motion,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from 'framer-motion';
import {
    ArrowRight,
    BellRing,
    CheckCheck,
    Factory,
    FileCheck2,
    Languages,
    ReceiptIndianRupee,
    ShieldCheck,
    Smartphone,
    Store,
    Wallet,
} from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { MEDIA } from '@/lib/media';
import { appEntry, type Role } from '@/lib/links';
import { cn } from '@/lib/cn';
import { CountUp, Magnetic, useFinePointer } from './Motion';

const TRUST_ICONS = [ShieldCheck, Languages, Smartphone];

/**
 * Word-by-word rise. Pure CSS (`.word-rise` in globals.css), so it plays from
 * the server HTML before hydration and the text never depends on JS to show.
 * Re-keying the parent replays it on role switch.
 */
function Words({ text, offset = 0 }: { text: string; offset?: number }) {
    return text.split(' ').map((w, i) => (
        <Fragment key={i}>
            {i > 0 && ' '}
            <span className="word-rise" style={{ animationDelay: `${(offset + i) * 55}ms` }}>
                {w}
            </span>
        </Fragment>
    ));
}

/**
 * Warm mesh behind the hero: three blurred blobs breathing on their own
 * clocks (cream at the copy, slate behind the stage, orange between) and the
 * dot grid fading out of the stage. Pure CSS, so it costs nothing to hydrate.
 */
function HeroBackdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="mesh-blob mesh-a -top-[16%] -left-[14%] h-[72vw] w-[72vw] max-h-[720px] max-w-[720px] bg-[#ffedd5]" />
            <div className="mesh-blob mesh-b top-[6%] -right-[16%] h-[64vw] w-[64vw] max-h-[680px] max-w-[680px] bg-[#1e293b]/20" />
            <div className="mesh-blob mesh-c top-[36%] left-[32%] h-[46vw] w-[46vw] max-h-[480px] max-w-[480px] bg-accent/15" />
            <div className="hero-dots absolute inset-0" />
        </div>
    );
}

export function Hero({ lang }: { lang: Lang }) {
    const [role, setRole] = useState<Role>('retail');
    const t = getCopy(lang);
    const c = t.hero[role];
    const h1Words = c.h1.split(' ').length;

    // Cursor position over the hero, -1..1 on each axis, eased — the stage's
    // layers shift by it at different depths. Stays at 0 on touch.
    const fine = useFinePointer();
    const px = useSpring(0, { stiffness: 70, damping: 18, mass: 0.8 });
    const py = useSpring(0, { stiffness: 70, damping: 18, mass: 0.8 });
    const onMove = (e: PointerEvent<HTMLElement>) => {
        if (!fine) return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => {
        px.set(0);
        py.set(0);
    };

    return (
        <MotionConfig reducedMotion="user">
            <section
                id="top"
                onPointerMove={onMove}
                onPointerLeave={onLeave}
                className="hero-wash relative overflow-hidden"
            >
                <HeroBackdrop />

                {/* No bottom padding: the stage stands on the marquee below. */}
                <div className="wrap relative grid items-end gap-6 pt-12 md:pt-16 lg:grid-cols-2 lg:pt-10">
                    <div className="text-center lg:self-center lg:pb-14 lg:text-left">
                        {/* Role switch */}
                        <div
                            role="tablist"
                            aria-label={t.hero.switchLabel}
                            className="mx-auto mb-7 flex w-fit items-center gap-1 rounded-full border border-white/60 bg-white/70 p-1 shadow-[0_8px_24px_-12px_rgb(15,43,70,0.25)] backdrop-blur-md lg:mx-0"
                        >
                            {(
                                [
                                    ['retail', Store],
                                    ['wholesale', Factory],
                                ] as const
                            ).map(([key, Icon]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={role === key}
                                    onClick={() => setRole(key)}
                                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                                        role === key ? 'text-white' : 'text-muted hover:text-text'
                                    }`}
                                >
                                    {role === key && (
                                        <motion.span
                                            layoutId="role-pill"
                                            className="absolute inset-0 rounded-full bg-navy"
                                            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                        />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        <Icon size={16} aria-hidden="true" />
                                        {t.hero[key].tab}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <span key={`e-${role}`} className="hero-badge fade-in">
                            <span aria-hidden="true" className="hero-badge-dot" />
                            {c.eyebrow}
                        </span>
                        {/* Devanagari/Gujarati matras clip at tight leading — give them room. */}
                        <h1
                            key={`h-${role}`}
                            className={`mt-5 font-display text-[2.5rem] font-extrabold text-navy sm:text-6xl lg:text-[3.5rem] xl:text-[4.1rem] 2xl:text-[4.5rem] ${
                                lang === 'en' ? 'leading-[1.06]' : 'leading-[1.3]'
                            }`}
                        >
                            <Words text={c.h1} />
                            <br />
                            <span className="text-accent-strong">
                                <Words text={c.h1Accent} offset={h1Words} />
                            </span>
                        </h1>
                        <p
                            key={`s-${role}`}
                            className="fade-in mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0"
                        >
                            {c.sub}
                        </p>

                        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                            <Magnetic>
                                <a href={appEntry(lang, role)} className="btn btn-primary btn-shine group">
                                    {t.hero.ctaPrimary}
                                    <ArrowRight
                                        size={17}
                                        aria-hidden="true"
                                        className="transition-transform duration-200 group-hover:translate-x-1"
                                    />
                                </a>
                            </Magnetic>
                            <a href="#tour" className="btn btn-secondary">
                                {t.hero.ctaSecondary}
                            </a>
                        </div>

                        <ul
                            key={`t-${role}`}
                            className="fade-in mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start"
                        >
                            {c.trust.map((label, i) => {
                                const Icon = TRUST_ICONS[i];
                                return (
                                    <li key={label} className="flex items-center gap-1.5">
                                        <Icon size={15} className="text-navy" aria-hidden="true" />
                                        {label}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <HeroStage lang={lang} role={role} px={px} py={py} />
                </div>
            </section>
        </MotionConfig>
    );
}

/**
 * One depth plane of the stage: shifts `depth` px with the cursor and drifts
 * `drift` px over the first 800px of scroll. Both are exactly 0 at load, so
 * the server HTML and the hydrated page line up.
 */
function Layer({
    px,
    py,
    depth,
    drift = 0,
    className,
    children,
}: {
    px: MotionValue<number>;
    py: MotionValue<number>;
    depth: number;
    drift?: number;
    className?: string;
    children: ReactNode;
}) {
    const reduce = useReducedMotion();
    // Scroll drift only on mouse devices: on phones the stage is only seen
    // after scrolling, so drift would pull the cards off their data lines.
    const fine = useFinePointer();
    const d = fine ? drift : 0;
    const { scrollY } = useScroll();
    const x = useTransform(px, (v) => v * depth);
    const y = useTransform([py, scrollY], ([p, s]: number[]) => p * depth + (Math.min(s, 800) / 800) * d);
    return (
        <motion.div style={reduce ? undefined : { x, y }} className={className}>
            {children}
        </motion.div>
    );
}

/** A card that pops in after `delay`, then bobs gently on its own clock. */
function Floater({ delay, bob, children }: { delay: number; bob: number; children: ReactNode }) {
    return (
        <div className="pop-in" style={{ animationDelay: `${delay}ms` }}>
            <div className="float-y" style={{ animationDelay: `${bob}ms` }}>
                {children}
            </div>
        </div>
    );
}

/* One glass treatment for every floating card. */
const GLASS = 'border border-white/60 bg-white/80 shadow-xl shadow-navy/10 backdrop-blur-md';
const GLASS_DARK = 'border border-white/20 bg-navy/90 shadow-xl shadow-navy/25 backdrop-blur-md';

/**
 * The shopkeeper, standing in front of a navy dome, with the product floating
 * around him: money owed with its reminder out, the bill being built, a
 * reorder alert, and the compliance document for the chosen role.
 */
function HeroStage({
    lang,
    role,
    px,
    py,
}: {
    lang: Lang;
    role: Role;
    px: MotionValue<number>;
    py: MotionValue<number>;
}) {
    const t = getCopy(lang);
    const m = t.hero.mock;
    const tiles = role === 'retail' ? m.retailTiles : m.wholesaleTiles;
    // Money owed to you: udhar for a shop, dealer outstanding for a wholesaler.
    const [dueLabel, dueValue] = tiles[role === 'retail' ? 3 : 2];
    const [alertItem, alertCover] = m.rows[0];
    const doc = t.compliance.cards[role === 'retail' ? 0 : 1].title;
    const layer = { px, py };

    return (
        <div className="relative mx-auto h-[430px] w-full max-w-[560px] sm:h-[540px] lg:ml-auto lg:h-[680px] lg:max-w-[640px] xl:h-[740px] xl:max-w-[700px]">
            <Layer {...layer} depth={-8} className="absolute inset-x-[5%] -bottom-[16%] aspect-square">
                <div className="hero-dome absolute inset-0 rounded-full" />
                <svg
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    className="orbit absolute -inset-[7%] h-[114%] w-[114%] text-sand"
                >
                    <circle
                        cx="50"
                        cy="50"
                        r="49.5"
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity="0.7"
                        strokeWidth="0.3"
                        strokeDasharray="0.5 1.5"
                    />
                    <circle cx="50" cy="0.5" r="1.2" className="fill-accent-bright" />
                </svg>
            </Layer>

            <Layer {...layer} depth={9} className="absolute inset-0">
                <DataFlow />
            </Layer>

            <Layer {...layer} depth={5} drift={30} className="absolute inset-0">
                <Image
                    src={MEDIA.heroCutout.src}
                    alt={MEDIA.heroCutout.alt[lang]}
                    fill
                    priority
                    sizes="(max-width: 640px) 92vw, 700px"
                    className="cutout-rise object-contain object-bottom"
                />
            </Layer>

            {/* Money owed, reminder already out */}
            <Layer {...layer} depth={16} drift={-45} className="absolute top-[5%] -right-4 z-10 sm:top-[17%] sm:right-auto sm:-left-8">
                <Floater delay={400} bob={-1200}>
                    <div className={cn('card', GLASS, 'w-[10.5rem] p-3 sm:w-[13.5rem] sm:p-3.5')}>
                        <div className="flex items-center gap-2.5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger-tint text-danger">
                                <Wallet size={17} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-[11px] text-muted">{dueLabel}</p>
                                <p className="tabular font-display text-lg leading-tight font-extrabold text-navy">
                                    <CountUp value={dueValue} />
                                </p>
                            </div>
                        </div>
                        <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-success-tint px-2 py-1 text-[11px] font-semibold text-success">
                            <CheckCheck size={13} aria-hidden="true" />
                            {m.reminder}
                        </p>
                    </div>
                </Floater>
            </Layer>

            {/* The bill being built — too wide for a phone stage */}
            <Layer {...layer} depth={22} drift={-70} className="absolute top-[3%] right-0 z-10 hidden sm:block lg:-right-6">
                <Floater delay={600} bob={-3400}>
                    <LiveBill key={role} lang={lang} role={role} className={'w-[15rem] rounded-2xl'} />
                </Floater>
            </Layer>

            {/* Reorder alert */}
            <Layer {...layer} depth={26} drift={-35} className="absolute top-[60%] -left-1 z-10 sm:top-[58%] sm:-left-12">
                <Floater delay={800} bob={-500}>
                    <div className={cn('card', GLASS, 'flex items-center gap-3 py-2.5 pr-4 pl-2.5')}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-tint text-warning">
                            <BellRing size={16} aria-hidden="true" className="bento-ring" />
                        </span>
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.12em] text-warning uppercase">{m.alert}</p>
                            <p className="text-sm font-semibold whitespace-nowrap text-navy">
                                {alertItem} · <span className="text-danger">{alertCover}</span>
                            </p>
                        </div>
                    </div>
                </Floater>
            </Layer>

            {/* Compliance, done */}
            <Layer {...layer} depth={12} drift={-20} className="absolute right-0 bottom-[6%] z-10 sm:right-2">
                <Floater delay={1000} bob={-2600}>
                    <div className={cn('card', GLASS, 'flex items-center gap-2 !rounded-full py-2 pr-4 pl-2')}>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-success text-white">
                            <FileCheck2 size={14} aria-hidden="true" />
                        </span>
                        <span className="text-xs font-semibold whitespace-nowrap text-navy">{doc}</span>
                        <CheckCheck size={14} aria-hidden="true" className="text-success" />
                    </div>
                </Floater>
            </Layer>
        </div>
    );
}

/* Where each stream goes, in stage percentages: tablet screen → card centre. */
const STREAMS = [
    { d: 'M 74 64 C 58 58, 40 40, 18 22', dur: 4.2, begin: 0, className: 'hidden sm:block' }, // udhar due (card on the left)
    { d: 'M 76 62 C 88 52, 86 38, 81 29', dur: 4.2, begin: 0, className: 'sm:hidden' }, // udhar due on phones (card top-right)
    { d: 'M 76 58 C 88 48, 92 34, 82 16', dur: 3.6, begin: 1.3, className: 'hidden sm:block' }, // bill (hidden with it)
    { d: 'M 72 70 C 58 74, 40 76, 20 66', dur: 3.9, begin: 2.1 }, // reorder alert
    { d: 'M 78 72 C 86 78, 88 86, 84 92', dur: 3.0, begin: 0.7 }, // compliance
];

/**
 * Data streams from the tablet to the floating cards: a faint rail, a dashed
 * run flowing along it, and a glowing dot riding it on a loop (SMIL — no JS
 * per frame). Drawn in stage percentages so the lines land on the cards at
 * every breakpoint; strokes and dots don't scale with the box.
 */
function DataFlow() {
    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="flow-in absolute inset-0 h-full w-full overflow-visible"
        >
            <defs>
                <linearGradient id="flow-grad" gradientUnits="userSpaceOnUse" x1="80" y1="66" x2="20" y2="30">
                    <stop offset="0" stopColor="#ff8a3d" />
                    <stop offset="1" stopColor="#c25000" stopOpacity="0.55" />
                </linearGradient>
            </defs>
            {STREAMS.map((sfl, i) => (
                <g key={i} className={sfl.className}>
                    <path id={`flow-${i}`} d={sfl.d} className="flow-rail" />
                    <path d={sfl.d} className="flow-dash" style={{ animationDelay: `${-sfl.begin}s` }} />
                    {/* A hair-length round-capped stroke draws as a perfect dot even under
                        preserveAspectRatio="none" (a lone moveto would draw nothing). */}
                    {(['flow-dot flow-dot-halo', 'flow-dot'] as const).map((cls) => (
                        <path key={cls} d="M0 0 h0.01" className={cls}>
                            <animateMotion
                                dur={`${sfl.dur}s`}
                                begin={`${sfl.begin}s`}
                                repeatCount="indefinite"
                                calcMode="spline"
                                keyTimes="0;1"
                                keySplines="0.4 0 0.6 1"
                            >
                                <mpath href={`#flow-${i}`} />
                            </animateMotion>
                            <animate
                                attributeName="opacity"
                                values="0;1;1;0"
                                keyTimes="0;0.12;0.85;1"
                                dur={`${sfl.dur}s`}
                                begin={`${sfl.begin}s`}
                                repeatCount="indefinite"
                            />
                        </path>
                    ))}
                </g>
            ))}
        </svg>
    );
}

/**
 * A bill being built on loop: items land one by one, the total ticks up, then
 * it goes out on WhatsApp. Starts from the finished bill (that's what the server
 * renders), pauses off-screen, and stays still for reduced-motion users.
 */
function LiveBill({ lang, role, className }: { lang: Lang; role: Role; className?: string }) {
    const m = getCopy(lang).hero.mock;
    const items = role === 'retail' ? m.bill.retailItems : m.bill.wholesaleItems;
    const n = items.length;
    const [step, setStep] = useState(n); // 0..n items shown, n+1 = sent
    const [active, setActive] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.3 });
        if (ref.current) io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!active) return;
        const delay = step === 0 ? 500 : step < n ? 800 : step === n ? 900 : 2800;
        const id = setTimeout(() => setStep(step > n ? 0 : step + 1), delay);
        return () => clearTimeout(id);
    }, [active, step, n]);

    const shown = items.slice(0, Math.min(step, n));
    const total = shown.reduce((s, [, , amt]) => s + amt, 0);

    return (
        <div ref={ref} className={cn('flex flex-col rounded-xl p-4 text-white', GLASS_DARK, className)}>
            <p className="flex items-center gap-2 text-sm font-semibold">
                <ReceiptIndianRupee size={16} aria-hidden="true" />
                {role === 'retail' ? m.retailAction : m.wholesaleAction}
            </p>

            <ul className="mt-3 min-h-[4.75rem] space-y-1.5 text-xs">
                <AnimatePresence initial={false}>
                    {shown.map(([name, qty, amt]) => (
                        <motion.li
                            key={name}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            className="flex items-center justify-between gap-2 text-white/90"
                        >
                            <span className="truncate">
                                {name} <span className="text-white/65">{qty}</span>
                            </span>
                            <span className="tabular shrink-0">₹{amt.toLocaleString('en-IN')}</span>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>

            <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2">
                <span className="text-xs text-white/75">{m.bill.total}</span>
                <span className="tabular font-display text-lg font-extrabold">
                    <CountUp value={`₹${total}`} />
                </span>
            </div>

            <div className="mt-2 h-7">
                <AnimatePresence>
                    {step > n && (
                        <motion.p
                            initial={{ opacity: 0, scale: 0.9, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-semibold text-white"
                        >
                            <CheckCheck size={14} aria-hidden="true" />
                            <span className="truncate">{m.bill.sent}</span>
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
