/**
 * Stops password and OTP guessing — without letting a stranger lock a real
 * person out.
 *
 * - Per account AND network address: 5 wrong tries (password or OTP, counted
 *   together; a try more than 15 minutes old no longer counts) lock sign-in
 *   for 15 minutes FROM THAT ADDRESS. The owner, on their own network, still
 *   signs in — an owner's mobile number is printed on every bill, so anyone
 *   could otherwise keep the login locked for ever. In memory, per server process.
 * - Per account, all addresses together: 50 wrong tries in 15 minutes lock it
 *   for everyone (someone is guessing from many addresses). Kept on the user
 *   in the database, so it holds across restarts and several servers.
 * - When the visitor's address is not known (requests from this machine, or a
 *   proxy without TRUST_PROXY) nobody can be told apart, so the account itself
 *   locks after 5 wrong tries.
 * - Per network address: 30 failed sign-ins in 15 minutes (wrong password or
 *   OTP, or a number with no account) → wait. Stops one password being tried on
 *   many numbers. In memory, per server process. Loopback is never limited, so
 *   a reverse proxy without TRUST_PROXY can't lock everyone out as one address.
 * - OTP sends: one per 30 seconds per number, at most 5 an hour; and one
 *   network address may ask for at most 20 codes in 15 minutes, whatever the
 *   numbers — every code is a real WhatsApp message to someone's phone.
 */
import { AppError } from './AppError.js';
import User from '../models/User.js';

export const MAX_WRONG = 5;
/** Wrong tries on one account from every address together before it locks for everyone. */
export const ACCOUNT_MAX_WRONG = 50;
export const LOCK_MS = 15 * 60_000;
const IP_MAX_FAILS = 30;
const OTP_GAP_MS = 30_000;
const OTP_WINDOW_MS = 60 * 60_000;
const OTP_PER_WINDOW = 5;
const OTP_PER_IP = 20;

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

const ipOtpSends = new Map<string, { count: number; resetAt: number }>();

/** Before sending a code: counts it against the asking address and refuses past 20 in 15 minutes. In memory, per server process. */
export function allowOtpFromIp(ip?: string): void {
    if (isLoopback(ip)) return;
    const now = Date.now();
    let e = ipOtpSends.get(ip!);
    if (!e || e.resetAt <= now) ipOtpSends.set(ip!, (e = { count: 0, resetAt: now + LOCK_MS }));
    if (e.count >= OTP_PER_IP) throw AppError.tooManyRequests(`Too many codes asked for from this network. Try again in ${minutes(e.resetAt - now)} minute(s), or sign in with your password.`);
    e.count++;
    if (ipOtpSends.size > 10_000) for (const [k, v] of ipOtpSends) if (v.resetAt <= now) ipOtpSends.delete(k);
}

// ── Per account (and per address on that account) ──────────────────────────
type Guarded = { _id: any; lockedUntil?: Date | null };

/** Wrong tries on one account from one address, and until when that address is locked out of it. */
const pairFails = new Map<string, { count: number; lastAt: number; lockedUntil: number }>();
const pairKey = (userId: unknown, ip: string) => `${String(userId)}|${ip}`;
const LOCKED_NOW = () => AppError.tooManyRequests(`Too many wrong tries. Sign-in is locked for ${minutes(LOCK_MS)} minutes.`);

/** Refuses while the account is locked for everyone, or for this address. */
export function assertNotLocked(user: Guarded, ip?: string, now = new Date()): void {
    const until = Math.max(user.lockedUntil ? +user.lockedUntil : 0, isLoopback(ip) ? 0 : pairFails.get(pairKey(user._id, ip!))?.lockedUntil || 0);
    if (until > +now) {
        throw AppError.tooManyRequests(`Too many wrong tries. Sign-in is locked — try again in ${minutes(until - +now)} minute(s).`);
    }
}

/**
 * Counts a wrong password / OTP and always throws: "… — N tries left", or, on
 * the 5th from one address, locks that address out of the account (and drops
 * its OTP) for 15 minutes. The account itself locks at 50 from all addresses —
 * or at 5 when the address is not known.
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
    const total = Number(after?.loginFails) || 1;
    const known = !isLoopback(ip);
    if (total >= (known ? ACCOUNT_MAX_WRONG : MAX_WRONG)) {
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(+now + LOCK_MS), loginFails: 0 }, $unset: { otp: 1, otpExpiry: 1 } });
        throw LOCKED_NOW();
    }
    if (!known) throw AppError.badRequest(`${message} — ${tries(MAX_WRONG - total)} left`);

    const key = pairKey(user._id, ip!);
    let pair = pairFails.get(key);
    if (!pair || +now - pair.lastAt > LOCK_MS) pair = { count: 0, lastAt: +now, lockedUntil: 0 };
    pair.count++;
    pair.lastAt = +now;
    pairFails.set(key, pair);
    if (pairFails.size > 20_000) for (const [k, v] of pairFails) if (+now - v.lastAt > LOCK_MS && v.lockedUntil <= +now) pairFails.delete(k);
    if (pair.count >= MAX_WRONG) {
        pair.count = 0;
        pair.lockedUntil = +now + LOCK_MS;
        // The code being guessed is dropped, so a move to another address starts from a new one.
        await User.updateOne({ _id: user._id }, { $unset: { otp: 1, otpExpiry: 1 } });
        throw LOCKED_NOW();
    }
    throw AppError.badRequest(`${message} — ${tries(MAX_WRONG - pair.count)} left`);
}

/** After a good sign-in: forget the wrong tries. The caller saves the user. */
export function clearWrongTries(user: any, ip?: string): void {
    user.loginFails = 0;
    user.loginFailAt = undefined;
    user.lockedUntil = undefined;
    if (!isLoopback(ip)) pairFails.delete(pairKey(user._id, ip!));
}

/**
 * Before sending an OTP: refuses while locked, within 30 s of the last one, or
 * past 5 in an hour; otherwise records this send on `user` (the caller saves it).
 */
export function allowOtpSend(user: any, ip?: string, now = new Date()): void {
    assertNotLocked(user, ip, now);
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
