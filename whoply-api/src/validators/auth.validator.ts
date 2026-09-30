import { z } from 'zod';
import { mobileSchema, otpSchema, passwordSchema, languageSchema, businessTypeSchema, gstinSchema } from './common.validator.js';

/** Step 1 — request OTP for login */
export const loginSchema = z.object({
    mobile: mobileSchema,
});

/** Step 2a — verify OTP and complete login */
export const verifyOtpSchema = z.object({
    mobile: mobileSchema,
    otp: otpSchema,
    language: languageSchema.optional(),
});

/**
 * Step 2b — password login (alternative to OTP). No length rule here: the rule
 * applies when a password is SET; staff created before it existed may have a
 * shorter one and must still be able to log in.
 */
export const passwordLoginSchema = z.object({
    mobile: mobileSchema,
    password: z.string().min(1, 'Enter your password'),
    language: languageSchema.optional(),
});

/** Self-registration of a business owner */
export const registerSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    mobile: mobileSchema,
    password: passwordSchema.optional(),
    language: languageSchema.optional(),
});

/** Onboarding — create the business after first login */
export const onboardingSchema = z.object({
    businessName: z.string().min(2).max(120).trim(),
    type: businessTypeSchema,
    gstin: gstinSchema.optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
