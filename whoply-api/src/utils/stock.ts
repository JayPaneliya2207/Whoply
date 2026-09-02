/**
 * Stock mutation helpers.
 *
 * Every stock change used to run a `Product.updateOne` + `StockMovement.create`
 * per line item, sequentially — a 20-item bill cost 40 round-trips. These helpers
 * collapse that into a fixed 3 regardless of basket size, and keep the denormalised
 * `Product.isLowStock` flag in sync so low-stock queries stay index-backed.
 */
import type { Types } from 'mongoose';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';

export interface StockLine {
    productId: Types.ObjectId | string;
    /** Signed change: negative for a sale/dispatch, positive for a purchase/return. */
    delta: number;
}

export interface MovementMeta {
    reason: 'sale' | 'purchase' | 'return' | 'damage' | 'adjustment' | 'opening';
    refType?: string;
    refId?: Types.ObjectId | string;
    note?: string;
}

/**
 * Recompute `isLowStock` for the given products in a single pipeline update.
 * Uses a field-to-field comparison server-side, so it stays correct without
 * needing the caller to know the threshold.
 */
export async function syncLowStock(productIds: (Types.ObjectId | string)[]): Promise<void> {
    if (!productIds.length) return;
    await Product.updateMany(
        { _id: { $in: productIds } },
        [{ $set: { isLowStock: { $lte: ['$currentStock', '$lowStockThreshold'] } } }] as any,
        { updatePipeline: true } as any
    );
}

/**
 * Apply a batch of stock deltas and record the matching movements.
 * 3 round-trips total: bulk $inc, insertMany movements, one low-stock resync.
 */
export async function applyStockChanges(
    businessId: Types.ObjectId | string,
    lines: StockLine[],
    meta: MovementMeta
): Promise<void> {
    const effective = lines.filter((l) => Number(l.delta) !== 0);
    if (!effective.length) return;

    await Product.bulkWrite(
        effective.map((l) => ({
            updateOne: { filter: { _id: l.productId }, update: { $inc: { currentStock: l.delta } } },
        }))
    );

    await StockMovement.insertMany(
        effective.map((l) => ({
            businessId,
            productId: l.productId,
            reason: meta.reason,
            quantity: l.delta,
            refType: meta.refType,
            refId: meta.refId,
            note: meta.note,
        }))
    );

    await syncLowStock(effective.map((l) => l.productId));
}
