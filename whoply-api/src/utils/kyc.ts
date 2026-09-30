/**
 * Staff ID (KYC) details, cleaned before they are stored.
 *
 * Aadhaar is restricted by law (Aadhaar Act 2016 and the Aadhaar (Data
 * Security) Regulations): a business without authorisation may not keep a copy
 * of the card or the full number. So for Aadhaar we keep only the last 4 digits
 * ("XXXX XXXX 1234") and never a photo. A 12-digit number entered under any
 * other document type is treated as Aadhaar too.
 *
 * Other IDs (PAN, voter ID, driving licence…) keep their number and up to 5
 * photos. The app shows the same rule (whoply-app staff page).
 */
const DOC_TYPES = ['aadhaar', 'pan', 'voterid', 'driving', 'other'] as const;
type DocType = (typeof DOC_TYPES)[number];
const MAX_DOCS = 5;
/** Each photo is a data URL; ~1.5 MB of JPEG is plenty for an ID photo the app has already shrunk. */
const MAX_DOC_CHARS = 2_000_000;

export interface Kyc {
    docType?: DocType;
    docNumber?: string;
    verified?: boolean;
    documents?: string[];
}

/** "XXXX XXXX 1234" from anything containing at least 4 digits, else undefined. */
export function maskAadhaar(value: unknown): string | undefined {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : undefined;
}

/** True when a value is a full 12-digit Aadhaar number (spaces/dashes allowed). */
export const looksLikeAadhaar = (value: unknown) => String(value ?? '').replace(/\D/g, '').length === 12 && /^[\d\s-]+$/.test(String(value).trim());

export function sanitizeKyc(input: any): Kyc {
    if (!input || typeof input !== 'object') return {};
    const docType = (DOC_TYPES as readonly string[]).includes(input.docType) ? (input.docType as DocType) : undefined;
    const rawNumber = typeof input.docNumber === 'string' ? input.docNumber.trim().slice(0, 30) : '';
    const aadhaar = docType === 'aadhaar' || looksLikeAadhaar(rawNumber);

    const out: Kyc = { verified: input.verified === true };
    if (docType) out.docType = aadhaar ? 'aadhaar' : docType;
    if (aadhaar) {
        const masked = maskAadhaar(rawNumber);
        if (masked) out.docNumber = masked;
        out.documents = []; // never keep an Aadhaar copy
    } else {
        if (rawNumber) out.docNumber = rawNumber.toUpperCase();
        out.documents = (Array.isArray(input.documents) ? input.documents : [])
            .filter((d: unknown) => typeof d === 'string' && d.startsWith('data:image/') && d.length <= MAX_DOC_CHARS)
            .slice(0, MAX_DOCS);
    }
    return out;
}
