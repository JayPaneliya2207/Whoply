import { z } from 'zod';

export const mobileSchema = z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, 'Invalid mobile number');

export const otpSchema = z.string().trim().length(6, 'OTP must be 6 digits');

export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export const emailSchema = z.string().email('Invalid email');

export const languageSchema = z.enum(['en', 'hi', 'gu', 'mr']);

export const roleSchema = z.enum(['owner', 'manager', 'cashier', 'warehouse', 'salesStaff', 'accountant', 'admin']);

export const businessTypeSchema = z.enum(['retail', 'wholesale']);

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/** Optional GSTIN — empty is allowed, but a non-empty value must match the 15-char format. */
export const gstinSchema = z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), {
        message: 'Invalid GSTIN. Expected format like 22AAAAA0000A1Z5.',
    });
