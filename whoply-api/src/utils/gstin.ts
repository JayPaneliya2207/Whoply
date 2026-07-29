/**
 * GSTIN (Goods & Services Tax Identification Number) format helper.
 * 15 chars: 2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum char.
 * e.g. 22AAAAA0000A1Z5
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** True if `v` is a validly-formatted GSTIN. Empty/undefined is NOT valid — check presence first. */
export function isValidGstin(v?: string | null): boolean {
    return !!v && GSTIN_REGEX.test(String(v).trim().toUpperCase());
}

/**
 * Normalise + validate an optional GSTIN.
 * Returns the cleaned uppercase value, or throws the given error factory when a
 * non-empty value is malformed. Empty/undefined passes through as undefined.
 */
export function cleanGstin(v: string | undefined | null, onInvalid: (msg: string) => Error): string | undefined {
    const g = (v ?? '').trim().toUpperCase();
    if (!g) return undefined;
    if (!GSTIN_REGEX.test(g)) throw onInvalid('Invalid GSTIN. Expected format like 22AAAAA0000A1Z5.');
    return g;
}
