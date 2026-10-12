import { randomInt, timingSafeEqual } from 'node:crypto';
import { isDevMode } from './devMode.js';

/**
 * Generate a 6-digit OTP.
 * Dev/test (utils/devMode.ts) → fixed 123456 so manual testing is friction-free.
 * Everywhere else → a real random code, sent on WhatsApp
 * (services/whatsapp.service.ts). A live server with a wrong NODE_ENV still
 * gets the random code.
 */
export const generateOtp = (): string => {
    if (isDevMode()) return '123456';
    return String(randomInt(100000, 1000000)); // crypto-strength, not Math.random
};

/** Compare a typed OTP with the stored one without leaking how much matched. */
export const sameOtp = (typed: string, stored: string): boolean =>
    typed.length === stored.length && timingSafeEqual(Buffer.from(typed), Buffer.from(stored));

/** How long a code works — the WhatsApp message says the same number. */
export const OTP_MINUTES = 5;
/** OTP expiry: 5 minutes from now */
export const getOtpExpiry = (): Date => new Date(Date.now() + OTP_MINUTES * 60 * 1000);
