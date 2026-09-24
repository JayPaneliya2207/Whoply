'use client';

import { motion, type Variants } from 'framer-motion';
import { useReveal } from './Reveal';

const TONE = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' } as const;

const list: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.28, delayChildren: 0.2 } } };
const item: Variants = {
    hidden: { opacity: 0, x: -16, transition: { duration: 0 } },
    shown: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const dot: Variants = {
    hidden: { scale: 0, transition: { duration: 0 } },
    shown: { scale: 1, transition: { type: 'spring', stiffness: 500, damping: 15 } },
};
const line: Variants = {
    hidden: { scaleY: 0, transition: { duration: 0 } },
    shown: { scaleY: 1, transition: { duration: 1.6, ease: [0.65, 0, 0.35, 1] } },
};

/** Dispatch steps that play out in order as the card scrolls in. */
export function Timeline({
    steps,
    tones,
}: {
    steps: [string, string][];
    tones: readonly (keyof typeof TONE)[];
}) {
    const [ref, state] = useReveal<HTMLOListElement>(0.4);

    return (
        <motion.ol
            ref={ref}
            variants={list}
            initial={false}
            animate={state === 'hidden' ? 'hidden' : 'shown'}
            className="relative mt-5 space-y-4"
        >
            {/* Connector behind the dots, drawing downward. */}
            <motion.span
                variants={line}
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-[4.5px] w-px origin-top bg-border"
            />
            {steps.map(([title, sub], i) => (
                <motion.li key={title} variants={item} className="relative flex items-start gap-3">
                    <motion.span
                        variants={dot}
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${TONE[tones[i]]}`}
                    />
                    <div>
                        <p className="text-sm font-semibold text-navy">{title}</p>
                        <p className="tabular text-xs text-muted">{sub}</p>
                    </div>
                </motion.li>
            ))}
        </motion.ol>
    );
}
