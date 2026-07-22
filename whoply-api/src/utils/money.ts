/**
 * Money helpers — Whoply keeps all monetary values in paise-free rupees (Number)
 * but formats consistently for display / receipts.
 */
// Always prepend ₹ explicitly (never rely on ICU currency symbol, which can vary by runtime).
const nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const getMoneyFormatter = () => nf;
export const formatINR = (value: number): string => `₹${nf.format(value || 0)}`;
