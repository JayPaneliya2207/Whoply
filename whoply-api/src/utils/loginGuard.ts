/**
 * Stops password and OTP guessing.
 *
 * - Per account: 5 wrong tries (password or OTP, counted together; a try more
 *   than 15 minutes old no longer counts) lock sign-in for 15 minutes. Kept on
 *   the user in the database, so it holds across restarts and several servers.
 * - Per network address: 30 failed sign-ins in 15 minutes (wrong password or
 *   OTP, or a number with no account) → wait. Stops one password being tried on
 *   many numbers. In memory, per server process. Loopback is never limited, so
 *   a reverse proxy without TRUST_PROXY can't lock everyone out as one address.
 * - OTP sends: one per 30 seconds per number, at most 5 an hour.
 */
import { AppError } from './AppError.js';
import User from '../models/User.js';

export const MAX_WRONG = 5;
export const LOCK_MS = 15 * 60_000;
const IP_MAX_FAILS = 30;
const OTP_GAP_MS = 30_000;
const OTP_WINDOW_MS = 60 * 60_000;
const OTP_PER_WINDOW = 5;

/** The fields these checks read; select them with `+lockedUntil` etc. (they are hidden by default). */
export const GUARD_FIELDS = '+lockedUntil +otpSentAt +otpSends +otpWindowAt';

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));
const tries = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`;

// ── Per network address ────────────────────────────────────────────────────
const ipFails = new Map<string, { count: number; resetAt: number }>();
const isLoopback = (ip?: string) => !ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');

/** Refuses a sign-in attempt from an address that failed too often. */
export function assertIpAllowed(ip?: string): void {
    if (isLoopback(ip)) return;
    const e = ipFails.get(ip!);
    if (e && e.resetAt > Date.now() && e.count >= IP_MAX_FAILS) {
        throw AppError.tooManyRequests(`Too many failed sign-ins from this network. Try again in ${minutes(e.resetAt - Date.now())} minute(s).`);
    }
}

/** Counts a failed sign-in against the address. */
export function failedFromIp(ip?: string): void {
    if (isLoopback(ip)) return;
    const now = Date.now();
    const e = ipFails.get(ip!);
    if (!e || e.resetAt <= now) ipFails.set(ip!, { count: 1, resetAt: now + LOCK_MS });
    else e.count++;
    if (ipFails.size > 10_000) for (const [k, v] of ipFails) if (v.resetAt <= now) ipFails.delete(k);
}

// ── Per account ────────────────────────────────────────────────────────────
type Guarded = { _id: any; lockedUntil?: Date | null };

/** Refuses while the account is locked. */
export function assertNotLocked(user: Guarded, now = new Date()): void {
    if (user.lockedUntil && user.lockedUntil > now) {
        throw AppError.tooManyRequests(`Too many wrong tries. Sign-in is locked — try again in ${minutes(+user.lockedUntil - +now)} minute(s).`);
    }
}

/**
 * Counts a wrong password / OTP and always throws: "… — N tries left", or, on
 * the 5th, locks the account (and drops its OTP) for 15 minutes.
 */
export async function wrongTry(user: Guarded, ip: string | undefined, message: string): Promise<never> {
    failedFromIp(ip);
    const now = new Date();
    // One atomic step, so tries sent at the same moment are all counted.
    const after = await User.collection.findOneAndUpdate(
        { _id: user._id },
        [{ $set: { loginFails: { $cond: [{ $gt: ['$loginFailAt', new Date(+now - LOCK_MS)] }, { $add: [{ $ifNull: ['$loginFails', 0] }, 1] }, 1] }, loginFailAt: now } }],
        { returnDocument: 'after', projection: { loginFails: 1 } }
    );
    const fails = Number(after?.loginFails) || 1;
    if (fails >= MAX_WRONG) {
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(+now + LOCK_MS), loginFails: 0 }, $unset: { otp: 1, otpExpiry: 1 } });
        throw AppError.tooManyRequests(`Too many wrong tries. Sign-in is locked for ${minutes(LOCK_MS)} minutes.`);
    }
    throw AppError.badRequest(`${message} — ${tries(MAX_WRONG - fails)} left`);
}

/** After a good sign-in: forget the wrong tries. The caller saves the user. */
export function clearWrongTries(user: any): void {
    user.loginFails = 0;
    user.loginFailAt = undefined;
    user.lockedUntil = undefined;
}

/**
 * Before sending an OTP: refuses while locked, within 30 s of the last one, or
 * past 5 in an hour; otherwise records this send on `user` (the caller saves it).
 */
export function allowOtpSend(user: any, now = new Date()): void {
    assertNotLocked(user, now);
    if (user.otpSentAt && +now - +user.otpSentAt < OTP_GAP_MS) {
        throw AppError.tooManyRequests(`Please wait ${Math.ceil((OTP_GAP_MS - (+now - +user.otpSentAt)) / 1000)} seconds before asking for a new OTP.`);
    }
    const newWindow = !user.otpWindowAt || +now - +user.otpWindowAt >= OTP_WINDOW_MS;
    if (!newWindow && (user.otpSends || 0) >= OTP_PER_WINDOW) {
        throw AppError.tooManyRequests(`Too many OTPs asked for. Try again in ${minutes(OTP_WINDOW_MS - (+now - +user.otpWindowAt))} minute(s).`);
    }
    user.otpSends = newWindow ? 1 : (user.otpSends || 0) + 1;
    if (newWindow) user.otpWindowAt = now;
    user.otpSentAt = now;
}
