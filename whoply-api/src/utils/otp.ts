/**
 * Generate a 6-digit OTP.
 * Production → a real random code (dispatch it via your SMS provider).
 * Dev/test  → fixed 123456 so manual testing is friction-free.
 */
export const generateOtp = (): string => {
    if (process.env.NODE_ENV === 'production') {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    return '123456';
};

/** OTP expiry: 5 minutes from now */
export const getOtpExpiry = (): Date => new Date(Date.now() + 5 * 60 * 1000);
