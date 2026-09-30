/**
 * Shared steps of a retail sale — used by POS billing and by converting a
 * quotation into a bill, so both behave the same.
 */
import type { Types } from 'mongoose';
import Customer from '../models/Customer.js';
import CreditLedger from '../models/CreditLedger.js';
import { applyStockChanges, takeStock } from './stock.js';

type Line = { productId: Types.ObjectId | string; quantity: number; name?: string };

/**
 * Take the stock for a bill, then save it. takeStock is atomic per product, so
 * two tills selling the last unit can't both succeed (stock never goes below
 * zero). If saving the bill then fails, the stock is put back.
 */
export async function takeStockThenSave<T>(businessId: Types.ObjectId | string, lines: Line[], invoiceId: Types.ObjectId, save: () => Promise<T>): Promise<T> {
    await takeStock(businessId, lines, { reason: 'sale', refType: 'Invoice', refId: invoiceId });
    try {
        return await save();
    } catch (e) {
        await applyStockChanges(
            businessId,
            lines.map((l) => ({ productId: l.productId, delta: Number(l.quantity) })),
            { reason: 'adjustment', refType: 'Invoice', refId: invoiceId, note: 'Bill not saved — stock put back' }
        ).catch(() => {});
        throw e;
    }
}

/**
 * After a bill with a customer: loyalty points (1 per ₹100, every bill) and any
 * udhar in one atomic update — two bills for the same customer at once can't
 * lose each other's amounts — plus the udhar ledger row.
 */
export async function postSaleToCustomer(
    businessId: Types.ObjectId | string,
    customerId: Types.ObjectId | string,
    sale: { due: number; grandTotal: number; invoiceId: Types.ObjectId; invoiceNo: string }
): Promise<void> {
    const inc: Record<string, number> = { loyaltyPoints: Math.floor(sale.grandTotal / 100) };
    if (sale.due > 0) inc.creditBalance = sale.due;
    const customer = await Customer.findOneAndUpdate({ _id: customerId, businessId }, { $inc: inc }, { new: true });
    if (customer && sale.due > 0) {
        await CreditLedger.create({
            businessId,
            customerId,
            type: 'credit',
            amount: sale.due,
            balanceAfter: customer.creditBalance,
            refType: 'Invoice',
            refId: sale.invoiceId,
            note: `Credit sale ${sale.invoiceNo}`,
        });
    }
}
