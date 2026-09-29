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
