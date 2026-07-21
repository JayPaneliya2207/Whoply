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
