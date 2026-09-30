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
import { AppError } from './AppError.js';

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
 * Take stock out for a sale/dispatch without ever letting it go negative.
 * Each product is decremented only while it still has enough (a conditional
 * update, so two dispatches can't both take the last units); if any line falls
 * short, what was already taken is put back and the call throws a 400 naming
 * the product. Records movements and resyncs low stock like applyStockChanges.
 */
export async function takeStock(
    businessId: Types.ObjectId | string,
    lines: { productId: Types.ObjectId | string; quantity: number; name?: string }[],
    meta: MovementMeta
): Promise<void> {
    // The same product can appear on more than one line — take the total once.
    const need = new Map<string, { productId: Types.ObjectId | string; qty: number; name?: string }>();
    for (const l of lines) {
        const key = String(l.productId);
        const cur = need.get(key);
        if (cur) cur.qty += Number(l.quantity);
        else need.set(key, { productId: l.productId, qty: Number(l.quantity), name: l.name });
    }

    const taken: { productId: Types.ObjectId | string; qty: number }[] = [];
    for (const n of need.values()) {
        if (!(n.qty > 0)) continue;
        const r = await Product.updateOne(
            { _id: n.productId, businessId, currentStock: { $gte: n.qty } },
            { $inc: { currentStock: -n.qty } }
        );
        if (r.modifiedCount !== 1) {
            if (taken.length) {
                await Product.bulkWrite(taken.map((t) => ({ updateOne: { filter: { _id: t.productId }, update: { $inc: { currentStock: t.qty } } } })));
            }
            const p = await Product.findById(n.productId).select('name currentStock').lean();
            throw AppError.badRequest(`Not enough stock for ${p?.name || n.name || 'an item'} — have ${p?.currentStock ?? 0}, need ${n.qty}`);
        }
        taken.push({ productId: n.productId, qty: n.qty });
    }
    if (!taken.length) return;

    await StockMovement.insertMany(
        taken.map((t) => ({
            businessId,
            productId: t.productId,
            reason: meta.reason,
            quantity: -t.qty,
            refType: meta.refType,
            refId: meta.refId,
            note: meta.note,
        }))
    );
    await syncLowStock(taken.map((t) => t.productId));
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
