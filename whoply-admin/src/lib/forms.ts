/**
 * Country codes for the phone picker (India default) + government-document
 * placeholder formats so users know exactly what to type.
 */
export interface Country {
    code: string; // dial code e.g. +91
    iso: string; // ISO2 e.g. IN
    flag: string; // emoji flag
    name: string;
    maxLen: number; // national number length
}

export const COUNTRIES: Country[] = [
    { code: '+91', iso: 'IN', flag: '🇮🇳', name: 'India', maxLen: 10 },
    { code: '+1', iso: 'US', flag: '🇺🇸', name: 'United States', maxLen: 10 },
    { code: '+44', iso: 'GB', flag: '🇬🇧', name: 'United Kingdom', maxLen: 10 },
    { code: '+971', iso: 'AE', flag: '🇦🇪', name: 'UAE', maxLen: 9 },
    { code: '+65', iso: 'SG', flag: '🇸🇬', name: 'Singapore', maxLen: 8 },
    { code: '+61', iso: 'AU', flag: '🇦🇺', name: 'Australia', maxLen: 9 },
    { code: '+880', iso: 'BD', flag: '🇧🇩', name: 'Bangladesh', maxLen: 10 },
    { code: '+977', iso: 'NP', flag: '🇳🇵', name: 'Nepal', maxLen: 10 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

/** Government / common document placeholder formats (India). */
export const PLACEHOLDERS = {
    gstin: '22AAAAA0000A1Z5',
    pan: 'ABCDE1234F',
    aadhaar: 'XXXX XXXX XXXX',
    voterid: 'ABC1234567',
    driving: 'GJ01 20230012345',
    mobile: 'Enter mobile number',
    hsn: 'e.g. 6109',
    pincode: '6-digit PIN',
};

/** Placeholder + note per KYC document type. */
export const kycPlaceholder = (docType: string): string => {
    switch (docType) {
        case 'aadhaar': return PLACEHOLDERS.aadhaar;
        case 'pan': return PLACEHOLDERS.pan;
        case 'voterid': return PLACEHOLDERS.voterid;
        case 'driving': return PLACEHOLDERS.driving;
        default: return 'Document number';
    }
};
