'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { MousePointerClick } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { MEDIA } from '@/lib/media';
import { cn } from '@/lib/cn';
import { SpotDot, SpotProgress, spotVars, useSpotCycle, type Spot } from './Hotspots';

/**
 * Positions on `app-home.png` (the app's real home screen), in the order
 * of `tour.items`. Dots sit in the empty corner of each card so they never
 * cover a number; the spotlight centres on the card itself.
 */
const SPOTS: Spot[] = [
    { x: 28.4, y: 23, fx: 19.6, fy: 27.1, w: 21, h: 12.5 }, // today's sales
    { x: 26, y: 76.7, fx: 50, fy: 82.2, w: 60, h: 13.5 }, // top products
    { x: 22.5, y: 40.7, fx: 19.6, fy: 44.9, w: 21, h: 12.5 }, // pending udhar
    { x: 52.9, y: 40.7, fx: 50, fy: 44.9, w: 21, h: 12.5 }, // low stock
    { x: 19.5, y: 60.7, fx: 50, fy: 63.3, w: 60, h: 13 }, // net position
];

/**
 * The tablet lies back in 3D and stands up as it scrolls in, then invites
 * exploring: each list item lights its card on the screen. The screen is a
 * real screenshot of the app, so the bezel is drawn here rather than baked
 * into the picture and the hotspots stay exact at every size.
 */
export function DashboardShowcase({ lang }: { lang: Lang }) {
    const tour = getCopy(lang).tour;
    const { box, active, pick, cycling, interval } = useSpotCycle(SPOTS.length, 4200);

    const frame = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'center 0.55'] });
    const rotateX = useTransform(scrollYProgress, [0, 1], [26, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
    const y = useTransform(scrollYProgress, [0, 1], [70, 0]);

    return (
        <div ref={box} className="mt-14 grid items-center gap-10 lg:grid-cols-[0.78fr_2fr] lg:gap-12">
            {/* The list — the accessible way to drive the hotspots. */}
            <div className="order-2 lg:order-1">
                <p className="mb-4 flex items-center gap-2 text-sm text-white/60">
                    <MousePointerClick size={15} aria-hidden="true" className="text-sand" />
                    {tour.hint}
                </p>
                <ol className="space-y-2">
                    {tour.items.map((it, i) => {
                        const on = i === active;
                        return (
                            <li key={it.title}>
                                <button
                                    type="button"
                                    aria-expanded={on}
                                    onClick={() => pick(i)}
                                    onPointerEnter={(e) => e.pointerType === 'mouse' && pick(i)}
                                    className={cn(
                                        'relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-colors duration-300',
                                        on
                                            ? 'border-sand/40 bg-white/[0.09]'
                                            : 'border-transparent hover:border-white/12 hover:bg-white/[0.04]'
                                    )}
                                >
                                    <span className="flex items-center gap-3">
                                        <span
                                            className={cn(
                                                'tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-300',
                                                on ? 'bg-accent text-white' : 'bg-white/10 text-white/70'
                                            )}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className={cn('font-display font-bold', on ? 'text-white' : 'text-white/75')}>
                                            {it.title}
                                        </span>
                                    </span>
                                    <AnimatePresence initial={false}>
                                        {on && (
                                            <motion.span
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                className="block overflow-hidden"
                                            >
                                                <span className="block pt-2 pl-10 text-sm leading-relaxed text-white/70">
                                                    {it.cap}
                                                </span>
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                    {on && cycling && (
                                        <SpotProgress key={active} ms={interval} className="absolute inset-x-4 bottom-0 bg-white/10" />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>

            <div ref={frame} className="order-1 [perspective:1600px] lg:order-2">
                <motion.div
                    style={reduce ? undefined : { rotateX, scale, y }}
                    className="relative origin-bottom will-change-transform"
                >
                    {/* Warm light pooling under the tablet. */}
                    <div
                        aria-hidden="true"
                        className="absolute inset-x-[12%] top-[18%] bottom-[6%] rounded-[50%] bg-sand/20 blur-[70px]"
                    />
                    {/* Bezel. Padding is a % of the width, so it scales with the tablet. */}
                    <div className="relative rounded-[clamp(12px,2.6vw,30px)] bg-gradient-to-b from-[#232c3a] to-[#0b1119] p-[1.7%] shadow-[0_45px_90px_-35px_rgb(0,0,0,0.75)] ring-1 ring-white/20">
                        <span aria-hidden="true" className="absolute top-[0.85%] left-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 sm:h-1 sm:w-1" />
                        <div className="spot-stage relative" style={spotVars(SPOTS[active], 0.68)}>
                            <Image
                                src={MEDIA.dashboard.src}
                                alt={MEDIA.dashboard.alt[lang]}
                                width={MEDIA.dashboard.width}
                                height={MEDIA.dashboard.height}
                                sizes="(max-width: 1024px) 100vw, 1000px"
                                className="spot-mask relative h-auto w-full rounded-[clamp(6px,1.5vw,18px)]"
                            />
                            {SPOTS.map((s, i) => (
                                <SpotDot key={i} spot={s} active={i === active} onSelect={() => pick(i)} />
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
