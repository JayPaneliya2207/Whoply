/**
 * Same-state or other-state tax for the GST reports — the rule the e-invoice
 * JSON (utils/gstJson.ts) and the printed bill use: compare the first two
 * digits (state code) of the seller's and the buyer's GSTIN. Another state →
 * IGST; same state, or a buyer without a GSTIN (a counter sale) → CGST + SGST.
 */
const stateCode = (gstin?: string | null) => (gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '');

/**
 * MongoDB expression: true when the document's buyer (`buyerField`, e.g.
 * '$customerGstin' or '$dealerGstin') is registered in another state.
 * Always false for a seller without a GSTIN.
 */
export function interStateExpr(sellerGstin: string | null | undefined, buyerField: string): any {
    const seller = stateCode(sellerGstin);
    if (!seller) return false;
    const buyer = { $ifNull: [buyerField, ''] };
    return { $and: [{ $regexMatch: { input: buyer, regex: /^\d{2}/ } }, { $ne: [{ $substrCP: [buyer, 0, 2] }, seller] }] };
}

const r2 = (n: number) => +(+n || 0).toFixed(2);

/** Split a tax total into CGST / SGST / IGST, rounded so the three add back up to the total. */
export function splitTax(gst: number, igst: number) {
    const intra = r2(gst - igst);
    const cgst = r2(intra / 2);
    return { cgst, sgst: r2(intra - cgst), igst: r2(igst) };
}

/** One row of a GST report's rate-wise or HSN table, as the aggregations group it. */
export type TaxRow = { _id: any; name?: string; qty?: number; taxable: number; gst: number; igst: number };

/**
 * Sales rows minus the month's returns with the same key. A return whose rate or
 * HSN sold nothing this month (goods sold in an earlier month) still shows, as a
 * negative row — dropping it would overstate the tax.
 */
export function netRows(sales: TaxRow[], returns: TaxRow[], keyOf: (id: any) => string): TaxRow[] {
    const rows = new Map<string, TaxRow>();
    for (const s of sales) rows.set(keyOf(s._id), { ...s });
    for (const c of returns) {
        const key = keyOf(c._id);
        const row = rows.get(key) || { _id: c._id, name: c.name, qty: 0, taxable: 0, gst: 0, igst: 0 };
        row.taxable -= c.taxable;
        row.gst -= c.gst;
        row.igst -= c.igst;
        if (c.qty != null) row.qty = (row.qty || 0) - c.qty;
        rows.set(key, row);
    }
    return [...rows.values()];
}

/** netRows keys: rows grouped by GST rate, or by { hsn, rate }. */
export const rateKey = (id: any) => String(id || 0);
export const hsnKey = (id: any) => `${id.hsn}|${id.rate || 0}`;

/** The report's rate-wise table (lowest rate first). */
export const rateTable = (rows: TaxRow[]) =>
    rows.map((r) => ({ rate: r._id || 0, taxable: r2(r.taxable), ...splitTax(r.gst, r.igst), gst: r2(r.gst) })).sort((a, b) => a.rate - b.rate);

/** The report's HSN table (biggest taxable value first). */
export const hsnTable = (rows: TaxRow[]) =>
    rows
        .map((h) => ({ hsn: h._id.hsn, name: h.name, rate: h._id.rate || 0, qty: +(h.qty || 0).toFixed(3), taxable: r2(h.taxable), ...splitTax(h.gst, h.igst), gst: r2(h.gst) }))
        .sort((a, b) => b.taxable - a.taxable);
