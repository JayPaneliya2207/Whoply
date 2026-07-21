/**
 * Money helpers — Whoply keeps all monetary values in paise-free rupees (Number)
 * but formats consistently for display / receipts.
 */
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const getMoneyFormatter = () => inr;
export const formatINR = (value: number): string => inr.format(value || 0);
