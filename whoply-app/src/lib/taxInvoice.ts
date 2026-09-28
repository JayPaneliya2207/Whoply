/**
 * The GST parts of a printed bill (CGST Rules, rule 46): taxable value per
 * line, the CGST + SGST (same state) or IGST (other state) split, an HSN-wise
 * tax summary, place of supply and the amount in words.
 *
 * Same state or not is decided like the e-invoice JSON (whoply-api
 * utils/gstJson.ts): from the first two digits of the shop's and the buyer's
 * GSTIN. A buyer without a GSTIN is a counter sale — the shop's own state.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Escape text going into printed HTML (item, customer and shop names are user-typed). */
export const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** GST state codes → state / UT names (for "Place of supply"). */
const STATES: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
    '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
    '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
    '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
    '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};
const stateCode = (gstin?: string) => (gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '');

export interface TaxLine {
    name: string;
    hsn: string;
    quantity: number;
    unit: string;
    price: number;
    rate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
}
export interface TaxSummaryRow { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }

export function gstBreakup(inv: any, biz?: { gstin?: string; state?: string }) {
    const sellerSt = stateCode(biz?.gstin);
    const buyerSt = stateCode(inv.customerGstin) || sellerSt;
    const inter = !!(sellerSt && buyerSt && sellerSt !== buyerSt);

    // Older bills took the discount off the total instead of storing each line's
    // taxable value — scale their lines by what was actually charged.
    const gross = (inv.subtotal || 0) + (inv.totalGst || 0);
    const keep = inv.discount && gross > 0 ? Math.min(1, (inv.grandTotal ?? gross) / gross) : 1;

    const lines: TaxLine[] = (inv.items || []).map((it: any) => {
        const taxable = r2(it.taxableValue ?? it.price * it.quantity * keep);
        const gst = r2(it.taxableValue != null ? it.gstAmount || 0 : (it.gstAmount || 0) * keep);
        const cgst = inter ? 0 : r2(gst / 2);
        return {
            name: it.name, hsn: it.hsn || '', quantity: it.quantity, unit: it.unit || 'pcs', price: it.price, rate: it.gstRate || 0,
            taxable, cgst, sgst: inter ? 0 : r2(gst - cgst), igst: inter ? gst : 0, total: r2(taxable + gst),
        };
    });

    const byKey = new Map<string, TaxSummaryRow>();
    for (const l of lines) {
        const k = `${l.hsn}|${l.rate}`;
        const row = byKey.get(k) || { hsn: l.hsn, rate: l.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        row.taxable = r2(row.taxable + l.taxable); row.cgst = r2(row.cgst + l.cgst); row.sgst = r2(row.sgst + l.sgst); row.igst = r2(row.igst + l.igst);
        byKey.set(k, row);
    }
    const summary = [...byKey.values()].sort((a, b) => a.rate - b.rate);
    const sum = (k: keyof TaxSummaryRow) => r2(summary.reduce((s, x) => s + (x[k] as number), 0));

    const posCode = buyerSt || sellerSt;
    return {
        inter,
        lines,
        summary,
        taxable: sum('taxable'),
        cgst: sum('cgst'),
        sgst: sum('sgst'),
        igst: sum('igst'),
        placeOfSupply: posCode ? `${STATES[posCode] || biz?.state || ''} (${posCode})` : biz?.state || '',
        /** A registered shop issues a Tax Invoice; without a GSTIN it's a plain bill. */
        title: biz?.gstin ? 'TAX INVOICE' : 'INVOICE',
    };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
    'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const upTo99 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);
const upTo999 = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', upTo99(n % 100)].filter(Boolean).join(' ');

/** ₹1,23,456.50 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only". */
export function amountInWords(amount: number): string {
    const total = Math.round(Math.abs(amount) * 100);
    let n = Math.floor(total / 100);
    const paise = total % 100;
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(`${crore >= 100 ? upTo999(crore) : upTo99(crore)} Crore`);
    if (lakh) parts.push(`${upTo99(lakh)} Lakh`);
    if (thousand) parts.push(`${upTo99(thousand)} Thousand`);
    if (n) parts.push(upTo999(n));
    const rupees = parts.join(' ') || 'Zero';
    return `Rupees ${rupees}${paise ? ` and ${upTo99(paise)} Paise` : ''} Only`;
}
