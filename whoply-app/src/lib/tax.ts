/**
 * GST maths for the POS preview — a copy of whoply-api src/utils/tax.ts
 * `priceLines`, so the total on screen is the total the server saves.
 * Change both together.
 *
 * `unitPrice` is the product's price as entered: including GST when
 * `inclusive` (MRP style), else GST is added on top. `billDiscount` is rupees
 * off the amount payable, spread over the lines and taken off before tax.
 */

export interface TaxInput {
    unitPrice: number;
    quantity: number;
    gstRate: number;
    inclusive: boolean;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceLines(inputs: TaxInput[], billDiscount = 0) {
    const gross = inputs.map((i) =>
        i.inclusive ? i.unitPrice * i.quantity : i.unitPrice * i.quantity * (1 + i.gstRate / 100)
    );
    const totalGross = gross.reduce((a, b) => a + b, 0);
    const disc = Math.min(Math.max(0, Number(billDiscount) || 0), totalGross);
    const keep = totalGross > 0 ? 1 - disc / totalGross : 1;

    let subtotal = 0;
    let taxableSum = 0;
    let totalGst = 0;
    let grandTotal = 0;
    const lines = inputs.map((i, k) => {
        const r = i.gstRate / 100;
        const taxable0 = round2(i.inclusive ? gross[k] / (1 + r) : i.unitPrice * i.quantity);
        let taxableValue: number, gstAmount: number, lineTotal: number;
        if (i.inclusive) {
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
        /** Σ gross (what the items cost before the bill discount, GST included) */
        gross: round2(totalGross),
        subtotal: round2(subtotal),
        discount: round2(subtotal - taxableSum),
        totalGst: round2(totalGst),
        grandTotal: round2(grandTotal),
    };
}
