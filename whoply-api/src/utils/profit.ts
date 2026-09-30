/**
 * Retail profit from real cost prices — shared by the Reports screen, the
 * monthly profit endpoint and the dashboard, so they all agree.
 */
import type { Types } from 'mongoose';
import Invoice from '../models/Invoice.js';
import CreditNote from '../models/CreditNote.js';

/** Retail credit notes (returns against a POS bill), as opposed to wholesale ones (orderId). */
export const RETAIL_CN = { invoiceId: { $exists: true, $ne: null } };

const r2 = (n: number) => +(+n || 0).toFixed(2);

/** Cost of goods: Σ qty × product cost price over a collection's lines matching `match`. */
export async function costOfLines(model: typeof Invoice | typeof CreditNote, match: Record<string, any>): Promise<number> {
    const rows = await (model as any).aggregate([
        { $match: match },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$p.costPrice', 0] }] } } } },
    ]);
    return rows[0]?.cogs || 0;
}

/**
 * Gross profit for [from, to): sales before GST less returns (before GST), less
 * the cost of what was sold (goods that came back come off the cost).
 */
export async function retailGrossProfit(businessId: Types.ObjectId, from: Date, to?: Date) {
    const createdAt = to ? { $gte: from, $lt: to } : { $gte: from };
    const sum = { $group: { _id: null, total: { $sum: '$grandTotal' }, gst: { $sum: '$totalGst' } } };
    const [inv, cn, sold, returned] = await Promise.all([
        Invoice.aggregate([{ $match: { businessId, createdAt } }, sum]),
        CreditNote.aggregate([{ $match: { businessId, ...RETAIL_CN, createdAt } }, { $group: { _id: null, total: { $sum: '$total' }, gst: { $sum: '$totalGst' } } }]),
        costOfLines(Invoice, { businessId, createdAt }),
        costOfLines(CreditNote, { businessId, ...RETAIL_CN, createdAt }),
    ]);
    const salesExGst = (inv[0]?.total || 0) - (inv[0]?.gst || 0) - ((cn[0]?.total || 0) - (cn[0]?.gst || 0));
    const cogs = sold - returned;
    return { salesExGst: r2(salesExGst), cogs: r2(cogs), grossProfit: r2(salesExGst - cogs) };
}
