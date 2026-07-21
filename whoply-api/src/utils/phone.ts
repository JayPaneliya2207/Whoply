/**
 * Normalize an Indian mobile number to a canonical 10-digit string
 * (strips +91 / 0 prefixes and non-digits).
 */
export const normalizePhone = (mobile: string): string => {
    let digits = String(mobile).replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(-10);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return digits;
};
