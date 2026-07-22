import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Always render the Indian Rupee symbol explicitly (never rely on locale/ICU currency symbol).
export const inr = (v: number) =>
    `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v || 0)}`;

export const inr2 = (v: number) =>
    `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`;
