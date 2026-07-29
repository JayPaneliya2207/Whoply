import type { CSSProperties } from 'react';

/**
 * Unmistakable Indian Rupee glyph, used as a money icon.
 * Renders the real ₹ character (bold) instead of Lucide's thin `IndianRupee`
 * line-icon, which can read like an "S"/"$" at small sizes. Drop-in compatible
 * with how Lucide icons are used here: accepts `size`, `className`, `style`, and
 * inherits colour from `currentColor` (text color).
 */
export function RupeeIcon({ size = 18, className, style }: { size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }) {
    return (
        <span
            aria-hidden="true"
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                fontSize: Math.round(size * 0.92),
                fontWeight: 800,
                lineHeight: 1,
                ...style,
            }}
        >
            ₹
        </span>
    );
}
