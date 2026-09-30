import { randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Generate a 6-digit OTP.
 * Production → a real random code (dispatch it via your SMS provider).
 * Dev/test  → fixed 123456 so manual testing is friction-free.
 */
export const generateOtp = (): string => {
    if (process.env.NODE_ENV === 'production') {
        return String(randomInt(100000, 1000000)); // crypto-strength, not Math.random
    }
    return '123456';
};

/** Compare a typed OTP with the stored one without leaking how much matched. */
export const sameOtp = (typed: string, stored: string): boolean =>
    typed.length === stored.length && timingSafeEqual(Buffer.from(typed), Buffer.from(stored));

/** OTP expiry: 5 minutes from now */
export const getOtpExpiry = (): Date => new Date(Date.now() + 5 * 60 * 1000);
