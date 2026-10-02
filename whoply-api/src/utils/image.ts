/**
 * Pictures arrive as data URLs (the app shrinks them first) or as https links.
 * Anything else — scripts, SVG, other URL schemes, oversized blobs — is
 * refused before it reaches the database: a stored picture is later put in an
 * <img src>, and a single huge one would bloat every read of its document.
 */
import { AppError } from './AppError.js';

const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/i;

/** A clean picture value, '' to clear it, or a 400. `maxChars` is the data URL's length (≈ 1.37 × the file size). */
export function cleanImage(value: unknown, maxChars: number, label = 'Picture'): string {
    if (value === null || value === '') return '';
    if (typeof value !== 'string') throw AppError.badRequest(`${label} is not valid`);
    if (value.length > maxChars) throw AppError.badRequest(`${label} is too large — use a smaller photo`);
    if (!DATA_IMAGE.test(value) && !(value.length <= 500 && HTTPS_URL.test(value))) throw AppError.badRequest(`${label} must be a PNG, JPG or WebP picture`);
    return value;
}

/** Trimmed text of at most `max` characters, or a 400 naming the field. Objects and arrays are refused. */
export function cleanText(value: unknown, max: number, label: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string' && typeof value !== 'number') throw AppError.badRequest(`${label} is not valid`);
    const text = String(value).trim();
    if (text.length > max) throw AppError.badRequest(`${label} is too long (${max} characters max)`);
    return text;
}
