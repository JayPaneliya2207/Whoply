/**
 * Keeping a secret in the database so that a copy of the database, or a backup
 * file, is not enough to use it: AES-256-GCM with a key made from JWT_SECRET
 * and a purpose label (each kind of secret gets its own key).
 *
 * If JWT_SECRET is ever changed, what was sealed can no longer be read and has
 * to be entered again.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const keyFor = (purpose: string) => Buffer.from(hkdfSync('sha256', env.JWT_SECRET, Buffer.alloc(0), purpose, 32));

export function sealSecret(text: string, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** The sealed text, or null when it is missing, changed, sealed for another purpose or with another JWT_SECRET. */
export function unsealSecret(sealed: string | null | undefined, purpose: string): string | null {
    const [version, iv, tag, data] = String(sealed || '').split('.');
    if (version !== 'v1' || !iv || !tag || !data) return null;
    try {
        const decipher = createDecipheriv('aes-256-gcm', keyFor(purpose), Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}
