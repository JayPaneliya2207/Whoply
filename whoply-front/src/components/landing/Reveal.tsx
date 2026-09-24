'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * 'static' — on screen at hydration (or no JS): render normally, never animate.
 * 'hidden' — below the fold at mount: armed, waiting to scroll into view.
 * 'shown'  — scrolled into view: play the entrance.
 *
 * The server render is always 'static', so nothing ships hidden in the HTML and
 * the page still reads with JS disabled or hydration failed.
 */
export type RevealState = 'static' | 'hidden' | 'shown';

export function useReveal<T extends Element>(threshold = 0.15) {
    const ref = useRef<T>(null);
    const [state, setState] = useState<RevealState>('static');

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

        setState('hidden');
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setState('shown');
                    io.disconnect();
                }
            },
            { threshold, rootMargin: '0px 0px -8% 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [threshold]);

    return [ref, state] as const;
}

type Variant = 'up' | 'left' | 'right' | 'zoom' | 'wipe';

const HIDDEN: Record<Variant, string> = {
    up: 'translate-y-12 opacity-0',
    left: '-translate-x-14 opacity-0',
    right: 'translate-x-14 opacity-0',
    zoom: 'scale-[0.88] opacity-0',
    // Curtain from the bottom edge — for photos.
    wipe: '[clip-path:inset(100%_0_0_0_round_16px)]',
};

const SHOWN: Record<Variant, string> = {
    up: 'translate-y-0 opacity-100',
    left: 'translate-x-0 opacity-100',
    right: 'translate-x-0 opacity-100',
    zoom: 'scale-100 opacity-100',
    wipe: '[clip-path:inset(0_0_0_0_round_16px)]',
};

export function Reveal({
    children,
    delay = 0,
    variant = 'up',
    className,
    style: outerStyle,
}: {
    children: ReactNode;
    delay?: number;
    variant?: Variant;
    className?: string;
    /** Layout styles for the outer element, e.g. a grid-row span. */
    style?: CSSProperties;
}) {
    const [ref, state] = useReveal<HTMLDivElement>();

    const motionClass = cn(
        // Transition only on the way in — arming (static → hidden) must be instant.
        state === 'shown' &&
            'transition-[opacity,transform,clip-path] duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        state === 'static' ? '' : state === 'hidden' ? HIDDEN[variant] : SHOWN[variant]
    );
    const style = state === 'shown' ? { transitionDelay: `${delay}ms` } : undefined;

    // A fully clip-pathed element counts as not intersecting, so the observer
    // would never fire — watch an unclipped wrapper and clip the inner layer.
    if (variant === 'wipe') {
        return (
            <div ref={ref} className={className} style={outerStyle}>
                <div className={motionClass} style={style}>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} className={cn(motionClass, className)} style={{ ...outerStyle, ...style }}>
            {children}
        </div>
    );
}

/**
 * A heading whose words rise out of clipped boxes one after another — the
 * split-text reveal. Static on the server and when already on screen.
 */
export function RevealWords({
    text,
    as: Tag = 'h2',
    stagger = 45,
    className,
}: {
    text: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
    stagger?: number;
    className?: string;
}) {
    const [ref, state] = useReveal<HTMLElement>(0.4);
    const on = state !== 'hidden';
    return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Tag ref={ref as any} className={className}>
            {text.split(' ').map((w, i) => (
                <span key={i}>
                    {i > 0 && ' '}
                    <span className={cn('word-mask', on && 'on')}>
                        <span style={{ transitionDelay: `${i * stagger}ms` }}>{w}</span>
                    </span>
                </span>
            ))}
        </Tag>
    );
}

/** A gradient rule that draws itself along `axis` when scrolled into view. */
export function RevealLine({ axis = 'x', delay = 0, className }: { axis?: 'x' | 'y'; delay?: number; className?: string }) {
    const [ref, state] = useReveal<HTMLDivElement>(0.3);
    const hidden = state === 'hidden';
    return (
        <div
            ref={ref}
            aria-hidden="true"
            className={cn(
                'transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                axis === 'x' ? cn('origin-left', hidden ? 'scale-x-0' : 'scale-x-100') : cn('origin-top', hidden ? 'scale-y-0' : 'scale-y-100'),
                className
            )}
            style={{ transitionDelay: `${delay}ms` }}
        />
    );
}
