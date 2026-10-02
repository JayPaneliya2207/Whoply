import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Always render the Indian Rupee symbol explicitly (never rely on locale/ICU currency symbol).
export const inr = (v: number) =>
    `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v || 0)}`;

export const inr2 = (v: number) =>
    `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`;

/** Compact Indian money for tight spots: ₹1.2Cr, ₹3.4L, ₹12k, ₹850. */
export const inrShort = (v: number) => {
    const n = Math.abs(v || 0);
    const s = v < 0 ? '-' : '';
    if (n >= 1e7) return `${s}₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr`;
    if (n >= 1e5) return `${s}₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L`;
    if (n >= 1e3) return `${s}₹${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
    return `${s}₹${Math.round(n)}`;
};
