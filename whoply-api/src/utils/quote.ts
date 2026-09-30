/**
 * Quotation (estimate) validity — shared by retail and wholesale quotes.
 * A quote keeps its quoted prices until it expires; after that it can't be
 * converted and a new one is made at today's prices.
 */
import { AppError } from './AppError.js';
import { istDaysAgo, istDmy } from './ist.js';

export const DEFAULT_VALID_DAYS = 15;

/** Valid through the end of the Nth India-time day from today (default 15). */
export function validUntilFrom(validDays: unknown): Date {
    const days = validDays == null || validDays === '' ? DEFAULT_VALID_DAYS : Number(validDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw AppError.badRequest('An estimate can be valid for 1 to 365 days');
    return istDaysAgo(-(days + 1)); // midnight starting the day after the last valid day
}

/** Refuse to convert an expired quote. Quotes made before validity existed have none and stay convertible. */
export function assertNotExpired(quote: { validUntil?: Date | null }, now = new Date()): void {
    if (quote.validUntil && quote.validUntil <= now) {
        const lastDay = new Date(quote.validUntil.getTime() - 1);
        throw AppError.badRequest(`This estimate expired on ${istDmy(lastDay)} — make a new one at today's prices`);
    }
}
