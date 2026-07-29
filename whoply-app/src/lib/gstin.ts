/**
 * GSTIN format helper (shared across all GSTIN inputs).
 * 15 chars: 2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum char.
 * Example: 22AAAAA0000A1Z5
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const GSTIN_PLACEHOLDER = '22AAAAA0000A1Z5';

/** Uppercase, strip non-alphanumerics and cap at 15 — use in input onChange. */
export const maskGstin = (v: string): string => v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);

/** True when `v` is a validly-formatted 15-char GSTIN. Empty is NOT valid — check presence first. */
export const isValidGstin = (v?: string | null): boolean => !!v && GSTIN_REGEX.test(String(v).trim().toUpperCase());

/** True when a value should be flagged as invalid in the UI: 15 chars typed but malformed. */
export const gstinLooksInvalid = (v?: string | null): boolean => !!v && v.length === 15 && !isValidGstin(v);
