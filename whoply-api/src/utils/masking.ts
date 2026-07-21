export const maskMobile = (mobile?: string | null, visible = 4, maskChar = '*'): string | undefined | null => {
    if (mobile === undefined || mobile === null) return mobile;
    const str = String(mobile);
    const len = str.length;
    if (visible <= 0) return maskChar.repeat(len);
    if (len <= visible) return str;
    return maskChar.repeat(len - visible) + str.slice(-visible);
};

export default maskMobile;
