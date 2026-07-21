import { z } from 'zod';
import { mobileSchema, otpSchema, passwordSchema, languageSchema, businessTypeSchema } from './common.validator.js';

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

/** Step 2b — password login (alternative to OTP) */
export const passwordLoginSchema = z.object({
    mobile: mobileSchema,
    password: passwordSchema,
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
    gstin: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
