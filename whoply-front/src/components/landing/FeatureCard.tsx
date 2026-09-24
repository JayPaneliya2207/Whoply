'use client';

import {
    BarChart3,
    CalendarClock,
    FileSpreadsheet,
    FileText,
    Package,
    ReceiptIndianRupee,
    ScrollText,
    Smartphone,
    Truck,
    Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useReveal } from './Reveal';

/* Icons by name — the server page can't hand a component to a client one. */
const ICONS = {
    wallet: Wallet,
    calendarClock: CalendarClock,
    receipt: ReceiptIndianRupee,
    barChart3: BarChart3,
    fileText: FileText,
    truck: Truck,
    scrollText: ScrollText,
    fileSpreadsheet: FileSpreadsheet,
    smartphone: Smartphone,
    package: Package,
};
export type FeatureIcon = keyof typeof ICONS;

/**
 * A feature tile with things happening in it: a gradient hairline that fills
 * across the top as it scrolls in, an icon tile that tips toward you on hover,
 * and a large ghost of the icon that drifts in from the corner. `step` shows a
 * big numeral instead of the icon tile.
 */
export function FeatureCard({
    icon,
    title,
    body,
    step,
    delay = 0,
    dark = false,
    className,
}: {
    icon: FeatureIcon;
    title: string;
    body: string;
    step?: number;
    delay?: number;
    dark?: boolean;
    className?: string;
}) {
    const Icon = ICONS[icon];
    const [ref, state] = useReveal<HTMLDivElement>(0.3);

    return (
        <div
            ref={ref}
            className={cn(
                'group relative h-full overflow-hidden rounded-2xl border p-7 transition-[box-shadow,border-color,background-color,transform] duration-500',
                dark
                    ? 'border-white/12 bg-white/[0.06] hover:border-sand/40 hover:bg-white/[0.1] hover:shadow-[0_16px_98px_-20px_rgb(0,0,0,0.5)]'
                    : 'card hover:-translate-y-1 hover:border-sand hover:shadow-[0_16px_98px_-24px_rgb(15,43,70,0.22)]',
                className
            )}
        >
            {/* The fill line — draws left to right on reveal. */}
            <span
                aria-hidden="true"
                className={cn(
                    'absolute inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r from-accent-bright via-sand to-transparent transition-transform duration-[1300ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                    state === 'hidden' ? 'scale-x-0' : 'scale-x-100'
                )}
                style={{ transitionDelay: `${delay + 200}ms` }}
            />

            {/* Ghost icon in the corner, drifting up on hover. */}
            <Icon
                aria-hidden="true"
                size={140}
                strokeWidth={1.2}
                className={cn(
                    'absolute -right-8 -bottom-10 transition-[transform,color] duration-700 ease-out group-hover:-translate-x-3 group-hover:-translate-y-3 group-hover:-rotate-6',
                    dark ? 'text-white/[0.05] group-hover:text-sand/15' : 'text-navy/[0.045] group-hover:text-accent/[0.09]'
                )}
            />

            <div className="relative">
                {step ? (
                    <span className="tabular inline-block font-display text-4xl font-extrabold text-sand transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110">
                        {String(step).padStart(2, '0')}
                    </span>
                ) : (
                    <span
                        className={cn(
                            'grid h-11 w-11 place-items-center rounded-xl transition-[transform,background-color,color] duration-500 group-hover:-rotate-6 group-hover:scale-110',
                            dark
                                ? 'bg-sand text-navy group-hover:bg-white'
                                : 'bg-navy-tint text-navy group-hover:bg-accent group-hover:text-white'
                        )}
                    >
                        <Icon size={20} aria-hidden="true" />
                    </span>
                )}
                <h3 className={cn('mt-5 font-display text-lg font-bold', dark ? 'text-white' : 'text-navy')}>{title}</h3>
                <p className={cn('mt-2 text-[0.95rem] leading-relaxed', dark ? 'text-white/70' : 'text-muted')}>{body}</p>
            </div>
        </div>
    );
}
