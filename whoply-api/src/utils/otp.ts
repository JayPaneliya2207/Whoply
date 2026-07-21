/**
 * Generate 6-digit OTP.
 * In development we return a fixed OTP so testing is friction-free.
 * Swap to the random line when wiring a real SMS provider.
 */
export const generateOtp = (): string => {
    // return Math.floor(100000 + Math.random() * 900000).toString();
    return '123456';
};

/** OTP expiry: 5 minutes from now */
export const getOtpExpiry = (): Date => new Date(Date.now() + 5 * 60 * 1000);
