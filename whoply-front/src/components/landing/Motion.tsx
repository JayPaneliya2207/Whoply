'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useReveal } from './Reveal';

/**
 * True on a mouse or trackpad with motion allowed. Cursor-driven effects run
 * only then — on touch they'd fire on tap and leave things stuck mid-tilt.
 * False on the server, so the first paint is always the still version.
 */
export function useFinePointer() {
    const [fine, setFine] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
        const update = () => setFine(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return fine;
}

/** Leans toward the cursor while it's over the element — for primary CTAs. */
export function Magnetic({
    children,
    strength = 0.28,
    className,
}: {
    children: ReactNode;
    strength?: number;
    className?: string;
}) {
    const fine = useFinePointer();
    const x = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });
    const y = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });

    const onMove = (e: PointerEvent<HTMLDivElement>) => {
        if (!fine) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
    };
    const reset = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div onPointerMove={onMove} onPointerLeave={reset} style={{ x, y }} className={cn('inline-flex', className)}>
            {children}
        </motion.div>
    );
}

/**
 * Tips toward the cursor in 3D, with a soft glare under it. Give it the same
 * radius as the card inside so the glare's corners match.
 */
export function Tilt({ children, max = 6, className }: { children: ReactNode; max?: number; className?: string }) {
    const fine = useFinePointer();
    const rx = useSpring(0, { stiffness: 180, damping: 18 });
    const ry = useSpring(0, { stiffness: 180, damping: 18 });

    const onMove = (e: PointerEvent<HTMLDivElement>) => {
        if (!fine) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const reset = () => {
        rx.set(0);
        ry.set(0);
    };

    return (
        <motion.div
            onPointerMove={onMove}
            onPointerLeave={reset}
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
            className={cn('relative', fine && 'glare', className)}
        >
            {children}
        </motion.div>
    );
}

/** Moves its children against the scroll — `amount` px each way across the viewport. */
export function Parallax({
    children,
    amount = 40,
    className,
}: {
    children: ReactNode;
    amount?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);

    return (
        <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
            {children}
        </motion.div>
    );
}

/**
 * A photo frame whose picture drifts inside it as you scroll. The frame stays
 * put (so layout never moves); the oversized inner layer slides and eases in
 * from a slight zoom.
 */
export function ParallaxFrame({ children, className }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%']);
    const scale = useTransform(scrollYProgress, [0, 0.5], [1.18, 1.08]);

    return (
        <div ref={ref} className={cn('relative overflow-hidden', className)}>
            <motion.div
                style={reduce ? undefined : { y, scale }}
                className="absolute inset-0 will-change-transform [&_img]:h-full [&_img]:w-full [&_img]:object-cover"
            >
                {children}
            </motion.div>
        </div>
    );
}

function animateNumber(from: number, to: number, ms: number, onFrame: (n: number) => void) {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        onFrame(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
}

/**
 * Renders a figure like "₹49,299" or "< 10 sec", animating its number.
 * `onView` counts up from zero when scrolled into view; otherwise it animates
 * from the previous value whenever `value` changes. Values without digits are
 * rendered as-is. The server always renders the final value.
 */
export function CountUp({ value, onView = false }: { value: string; onView?: boolean }) {
    const m = value.match(/^(\D*)([\d,]+)(.*)$/);
    const target = m ? Number(m[2].replace(/,/g, '')) : 0;
    const [n, setN] = useState(target);
    const prev = useRef(target);
    const [ref, state] = useReveal<HTMLSpanElement>(0.6);

    // Value changes (e.g. hero role switch).
    useEffect(() => {
        const from = prev.current;
        prev.current = target;
        if (onView || from === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setN(target);
            return;
        }
        return animateNumber(from, target, 700, setN);
    }, [target, onView]);

    // Count from zero on first view.
    useEffect(() => {
        if (!onView) return;
        if (state === 'hidden') setN(0);
        if (state === 'shown') return animateNumber(0, target, 1400, setN);
    }, [onView, state, target]);

    if (!m) return <>{value}</>;
    return (
        <span ref={ref}>
            {m[1]}
            {n.toLocaleString('en-IN')}
            {m[3]}
        </span>
    );
}
