'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/**
 * A point of interest on a photo, in % of the image box. `x`/`y` place the dot;
 * `fx`/`fy` centre the spotlight (defaults to the dot) and `w`/`h` are the
 * spotlight's radii — the object is fully lit within 70% of them.
 */
export interface Spot {
    x: number;
    y: number;
    fx?: number;
    fy?: number;
    w: number;
    h: number;
}

/**
 * Which spot is lit. Starts at -1 (whole image, which is what the server
 * renders), steps through the spots on its own while the stage is on screen,
 * and stops for good once the visitor picks one. Reduced motion: never
 * auto-advances — the image stays whole until someone taps a dot.
 */
export function useSpotCycle(count: number, interval = 3800) {
    const box = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(-1);
    const [auto, setAuto] = useState(true);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setAuto(false);
            return;
        }
        const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.5 });
        if (box.current) io.observe(box.current);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!auto || !inView) return;
        const id = setTimeout(() => setActive((a) => (a + 1) % count), active === -1 ? 700 : interval);
        return () => clearTimeout(id);
    }, [auto, inView, active, count, interval]);

    const pick = useCallback((i: number) => {
        setAuto(false);
        setActive(i);
    }, []);

    return { box, active, pick, cycling: auto && inView, interval };
}

/** Custom properties for `.spot-stage` — the whole image when nothing is lit. */
export function spotVars(spot: Spot | undefined, dim: number): CSSProperties {
    if (!spot) return { '--spot-w': '200%', '--spot-h': '200%', '--spot-dim': dim } as CSSProperties;
    return {
        '--spot-x': `${spot.fx ?? spot.x}%`,
        '--spot-y': `${spot.fy ?? spot.y}%`,
        '--spot-w': `${spot.w}%`,
        '--spot-h': `${spot.h}%`,
        '--spot-dim': dim,
    } as CSSProperties;
}

/**
 * The pulsing dot. Mouse-only affordance: it sits outside the tab order and is
 * hidden from assistive tech, because the labelled buttons beside the image
 * drive the same state.
 */
export function SpotDot({
    spot,
    active,
    onSelect,
    onNavy = false,
}: {
    spot: Spot;
    active: boolean;
    onSelect: () => void;
    onNavy?: boolean;
}) {
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onSelect}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onSelect()}
            className="absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        >
            <span
                className={cn(
                    'spot-ping absolute inset-1.5 rounded-full',
                    active ? 'bg-accent/50' : onNavy ? 'bg-sand/40' : 'bg-navy/25'
                )}
            />
            <span
                className={cn(
                    'relative h-3.5 w-3.5 rounded-full ring-[5px] transition-[transform,background-color,box-shadow] duration-300',
                    active
                        ? 'scale-125 bg-accent ring-white shadow-[0_0_0_9px_rgb(194,80,0,0.25)]'
                        : onNavy
                          ? 'bg-sand ring-white/85'
                          : 'bg-navy ring-white'
                )}
            />
        </button>
    );
}

/** Fills across one auto-advance interval, so visitors can see it's moving on. */
export function SpotProgress({ ms, className }: { ms: number; className?: string }) {
    return (
        <span aria-hidden="true" className={cn('block h-0.5 overflow-hidden rounded-full', className)}>
            <span className="spot-progress block h-full w-full bg-accent-bright" style={{ animationDuration: `${ms}ms` }} />
        </span>
    );
}
