/**
 * GST maths for every priced document — POS bills, quotations, wholesale orders.
 *
 * `unitPrice` is what the shop entered for the product: INCLUDING GST when the
 * product is marked `priceIncludesGst` (MRP style), otherwise excluding it (GST
 * added on top). A bill-level `discount` is rupees off the amount payable; it is
 * spread over the lines in proportion to their value and taken off BEFORE tax,
 * so each line's taxable value and GST are what was really charged — the
 * figures GSTR-1/3B and the e-invoice need.
 *
 * The app's POS preview mirrors this function (whoply-app src/lib/tax.ts);
 * change both together.
 */

export interface TaxInput {
    unitPrice: number;
    quantity: number;
    gstRate: number; // %
    inclusive: boolean;
}

export interface TaxLine {
    /** Pre-tax unit price before any bill discount (what the item "costs" ex-GST). */
    price: number;
    /** Taxable value of the whole line after its share of the bill discount. */
    taxableValue: number;
    gstAmount: number;
    /** What the customer pays for this line, GST included. */
    lineTotal: number;
}

export interface TaxResult {
    lines: TaxLine[];
    /** Σ taxable value before the bill discount. */
    subtotal: number;
    /** The bill discount expressed pre-tax — so grandTotal = subtotal − discount + totalGst. */
    discount: number;
    totalGst: number;
    grandTotal: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceLines(inputs: TaxInput[], billDiscount = 0): TaxResult {
    const gross = inputs.map((i) =>
        i.inclusive ? i.unitPrice * i.quantity : i.unitPrice * i.quantity * (1 + i.gstRate / 100)
    );
    const totalGross = gross.reduce((a, b) => a + b, 0);
    const disc = Math.min(Math.max(0, Number(billDiscount) || 0), totalGross);
    const keep = totalGross > 0 ? 1 - disc / totalGross : 1; // share of each line left after the discount

    let subtotal = 0;
    let taxableSum = 0;
    let totalGst = 0;
    let grandTotal = 0;
    const lines = inputs.map((i, k) => {
        const r = i.gstRate / 100;
        const taxable0 = round2(i.inclusive ? gross[k] / (1 + r) : i.unitPrice * i.quantity);
        let taxableValue: number, gstAmount: number, lineTotal: number;
        if (i.inclusive) {
            // Work down from the amount paid so an MRP item never bills a paisa over MRP.
            lineTotal = round2(gross[k] * keep);
            taxableValue = round2(lineTotal / (1 + r));
            gstAmount = round2(lineTotal - taxableValue);
        } else {
            taxableValue = round2(taxable0 * keep);
            gstAmount = round2(taxableValue * r);
            lineTotal = round2(taxableValue + gstAmount);
        }
        subtotal += taxable0;
        taxableSum += taxableValue;
        totalGst += gstAmount;
        grandTotal += lineTotal;
        return { price: round2(taxable0 / i.quantity), taxableValue, gstAmount, lineTotal };
    });

    return {
        lines,
        subtotal: round2(subtotal),
        discount: round2(subtotal - taxableSum),
        totalGst: round2(totalGst),
        grandTotal: round2(grandTotal),
    };
}

/**
 * A stored line's value after the bill discount — for returns. New documents
 * carry `taxableValue`; older ones (before it existed) took the discount off the
 * total, so scale them by what was actually charged.
 */
export function netLineValue(
    doc: { subtotal?: number; totalGst?: number; discount?: number; grandTotal?: number; total?: number },
    item: { price: number; quantity: number; gstAmount?: number; taxableValue?: number }
): { taxable: number; gst: number } {
    if (item.taxableValue != null) return { taxable: item.taxableValue, gst: item.gstAmount || 0 };
    const gross = (doc.subtotal || 0) + (doc.totalGst || 0);
    const paid = doc.grandTotal ?? doc.total ?? gross;
    const keep = doc.discount && gross > 0 ? Math.min(1, paid / gross) : 1;
    return { taxable: item.price * item.quantity * keep, gst: (item.gstAmount || 0) * keep };
}
