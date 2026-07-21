/**
 * Lightweight demand-forecast / reorder engine.
 *
 * Not an LLM — a transparent heuristic over the last N days of sales:
 *   dailyVelocity   = unitsSold / windowDays
 *   daysOfCover     = currentStock / dailyVelocity
 *   suggestedQty    = max(0, ceil(velocity * targetCoverDays) - currentStock)
 * Products with the fewest days of cover surface first ("order before you run out").
 */
import { Types } from 'mongoose';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';

export interface ReorderSuggestion {
    productId: string;
    name: string;
    unit: string;
    currentStock: number;
    dailyVelocity: number;
    daysOfCover: number | null;
    suggestedQty: number;
    urgency: 'critical' | 'soon' | 'ok';
}

export async function reorderSuggestions(
    businessId: Types.ObjectId | string,
    windowDays = 30,
    targetCoverDays = 14
): Promise<ReorderSuggestion[]> {
    const bId = new Types.ObjectId(String(businessId));
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const sold = await Invoice.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', qty: { $sum: '$items.quantity' } } },
    ]);
    const soldMap = new Map(sold.map((s) => [String(s._id), s.qty]));

    const products = await Product.find({ businessId: bId, isActive: true }).lean();

    const suggestions = products.map((p) => {
        const unitsSold = soldMap.get(String(p._id)) || 0;
        const dailyVelocity = +(unitsSold / windowDays).toFixed(2);
        const daysOfCover = dailyVelocity > 0 ? +(p.currentStock / dailyVelocity).toFixed(1) : null;
        const target = Math.ceil(dailyVelocity * targetCoverDays);
        const suggestedQty = Math.max(0, target - p.currentStock);

        let urgency: ReorderSuggestion['urgency'] = 'ok';
        if (daysOfCover !== null && daysOfCover <= 5) urgency = 'critical';
        else if (daysOfCover !== null && daysOfCover <= 12) urgency = 'soon';
        else if (p.currentStock <= p.lowStockThreshold) urgency = 'soon';

        return {
            productId: String(p._id),
            name: p.name,
            unit: p.unit,
            currentStock: p.currentStock,
            dailyVelocity,
            daysOfCover,
            suggestedQty,
            urgency,
        };
    });

    // surface the ones that need action, most urgent first
    return suggestions
        .filter((s) => s.suggestedQty > 0 || s.urgency !== 'ok')
        .sort((a, b) => {
            const cover = (x: ReorderSuggestion) => (x.daysOfCover === null ? 9999 : x.daysOfCover);
            return cover(a) - cover(b);
        });
}
