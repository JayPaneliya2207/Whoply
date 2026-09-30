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

/** Plain check: are these two GSTINs in different states? (False if either has no state code.) */
export function isInterState(a: string | null | undefined, b: string | null | undefined): boolean {
    const sa = stateCode(a);
    const sb = stateCode(b);
    return !!sa && !!sb && sa !== sb;
}

const r2 = (n: number) => +(+n || 0).toFixed(2);

type Heads = { igst: number; cgst: number; sgst: number };

/**
 * GST to pay after input tax credit, using credit in the order the GST law sets
 * (s.49 CGST Act / rule 88A): IGST credit first against IGST, then CGST, then
 * SGST; CGST credit against CGST, then IGST; SGST credit against SGST, then
 * IGST. CGST credit never pays SGST (nor the reverse). Returns what is left to
 * pay per head and the credit carried forward. An estimate — the CA files.
 */
export function setOffGst(output: Heads, credit: Heads) {
    const pay = { igst: r2(output.igst), cgst: r2(output.cgst), sgst: r2(output.sgst) };
    const left = { igst: r2(credit.igst), cgst: r2(credit.cgst), sgst: r2(credit.sgst) };
    const use = (from: keyof Heads, to: keyof Heads) => {
        const n = Math.min(left[from], pay[to]);
        if (n > 0) { left[from] = r2(left[from] - n); pay[to] = r2(pay[to] - n); }
    };
    use('igst', 'igst'); use('igst', 'cgst'); use('igst', 'sgst');
    use('cgst', 'cgst'); use('cgst', 'igst');
    use('sgst', 'sgst'); use('sgst', 'igst');
    return { payable: { ...pay, total: r2(pay.igst + pay.cgst + pay.sgst) }, carryForward: { ...left, total: r2(left.igst + left.cgst + left.sgst) } };
}

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
