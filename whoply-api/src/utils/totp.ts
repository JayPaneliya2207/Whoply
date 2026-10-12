/**
 * The codes behind two-step sign-in (services/twoStep.service.ts).
 *
 * - The 6-digit code is the standard time-based one (RFC 6238: HMAC-SHA1,
 *   30-second steps), so any authenticator app works — Google Authenticator,
 *   Microsoft Authenticator, Authy — and nothing is sent by SMS.
 * - The secret is kept sealed in the database (AES-256-GCM, with a key made
 *   from JWT_SECRET): a copy of the database, or a backup file, can not make
 *   codes on its own. If JWT_SECRET is ever changed the secrets can no longer
 *   be read — switch two-step off with `npm run admin:2fa-off` and set it up again.
 * - Recovery codes (for a lost phone) are kept only as hashes.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { sealSecret, unsealSecret } from './seal.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_MS = 30_000;

export function toBase32(bytes: Uint8Array): string {
    let out = '';
    let value = 0;
    let bits = 0;
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
        value &= (1 << bits) - 1;
    }
    if (bits) out += BASE32[(value << (5 - bits)) & 31];
    return out;
}

export function fromBase32(text: string): Buffer {
    const out: number[] = [];
    let value = 0;
    let bits = 0;
    for (const ch of text.toUpperCase().replace(/[\s=-]/g, '')) {
        const v = BASE32.indexOf(ch);
        if (v < 0) throw new Error('Not a base32 key');
        value = (value << 5) | v;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
            value &= (1 << bits) - 1;
        }
    }
    return Buffer.from(out);
}

/** A new secret: 160 random bits, written the way authenticator apps take it. */
export const newSecret = (): string => toBase32(randomBytes(20));

/** The 30-second step a moment falls in. */
export const stepAt = (ms = Date.now()): number => Math.floor(ms / STEP_MS);

/** The 6-digit code for a step (RFC 4226 truncation). */
export function codeAt(secret: string, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest();
    const at = mac[mac.length - 1] & 15;
    const num = ((mac[at] & 127) << 24) | (mac[at + 1] << 16) | (mac[at + 2] << 8) | mac[at + 3];
    return String(num % 1_000_000).padStart(6, '0');
}

/**
 * The step a code belongs to, or null when it is wrong. The step now, the one
 * before and the one after all count — phone clocks are never exactly right.
 */
export function findStep(secret: string, code: string, now = Date.now()): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const given = Buffer.from(code);
    const current = stepAt(now);
    for (const step of [current, current - 1, current + 1]) {
        if (timingSafeEqual(given, Buffer.from(codeAt(secret, step)))) return step;
    }
    return null;
}

/** What the QR code holds: the link an authenticator app reads to add the login. */
export const otpauthUrl = (secret: string, account: string, issuer = 'Whoply Admin'): string =>
    `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

// ── Keeping the secret in the database (utils/seal.ts) ─────────────────────
const SEAL_PURPOSE = 'whoply two-step secret';
export const seal = (text: string): string => sealSecret(text, SEAL_PURPOSE);
/** The sealed text, or null when it is missing, changed, or sealed with another JWT_SECRET. */
export const unseal = (sealed?: string | null): string | null => unsealSecret(sealed, SEAL_PURPOSE);

// ── Recovery codes ─────────────────────────────────────────────────────────
/** Letters and digits that are not mixed up when written down (no 0/o, 1/l/i). */
const RECOVERY_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const RECOVERY_LENGTH = 10;

/** One-time codes for signing in without the phone, as "abcde-fghjk". */
export const newRecoveryCodes = (count = 8): string[] =>
    Array.from({ length: count }, () => {
        const s = Array.from({ length: RECOVERY_LENGTH }, () => RECOVERY_CHARS[randomInt(RECOVERY_CHARS.length)]).join('');
        return `${s.slice(0, 5)}-${s.slice(5)}`;
    });

/** A typed recovery code without its dash, spaces and capitals — or '' when it can not be one. */
export const plainRecovery = (code: string): string => {
    const plain = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    return plain.length === RECOVERY_LENGTH ? plain : '';
};

export const recoveryHash = (code: string): string => createHash('sha256').update(plainRecovery(code)).digest('hex');
