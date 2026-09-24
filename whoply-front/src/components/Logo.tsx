import { cn } from '@/lib/cn';

/**
 * Whoply mark + wordmark.
 * The mark is a stylised "W" shopfront. On navy surfaces the mark plate goes sand
 * and the strokes navy; on light surfaces the plate is navy with white strokes.
 */
export function Logo({
    className,
    showText = true,
    size = 32,
    onNavy = false,
}: {
    className?: string;
    showText?: boolean;
    size?: number;
    onNavy?: boolean;
}) {
    const plate = onNavy ? 'var(--color-sand)' : 'var(--color-navy)';
    const stroke = onNavy ? 'var(--color-navy)' : '#ffffff';
    const dot = 'var(--color-accent-bright)';

    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <rect width="40" height="40" rx="11" fill={plate} />
                <path
                    d="M9 13.5L14 27L20 16L26 27L31 13.5"
                    stroke={stroke}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="20" cy="10.5" r="2.4" fill={dot} />
            </svg>
            {showText && (
                <span
                    className="font-display text-[1.25rem] font-extrabold tracking-tight"
                    style={{ color: onNavy ? '#ffffff' : 'var(--color-navy)' }}
                >
                    Whoply
                </span>
            )}
        </div>
    );
}
