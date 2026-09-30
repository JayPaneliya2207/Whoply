/**
 * Wholesaler money helpers. A dealer's outstanding is the single source of truth =
 * the sum of that dealer's unpaid order dues. Deriving it (instead of trusting a
 * stored counter) keeps the Dealers list, dashboard and account tally consistent.
 */
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import PriceList from '../models/PriceList.js';
import Payment, { type PaymentMode } from '../models/Payment.js';
import type { DealerTier } from '../models/Dealer.js';
import { AppError } from './AppError.js';
import { priceLines } from './tax.js';
import { lineQty } from './qty.js';
import { Types } from 'mongoose';

type Tier = 'A' | 'B' | 'C';

/** Suggested tier multipliers off the base: Premium (best) < Standard < Basic (small buyers). */
export const TIER_MULT: Record<Tier, number> = { A: 0.95, B: 1.0, C: 1.06 };

/** A product's base wholesale price (falls back to the retail sell price). */
export const tierBase = (p: { wholesalePrice?: number; sellPrice?: number }) => p.wholesalePrice || p.sellPrice || 0;

/**
 * The tier price used when the wholesaler hasn't saved one. Computed on the fly
 * (never stored), so a change to the base price flows straight through.
 */
export const defaultTierPrice = (p: { wholesalePrice?: number; sellPrice?: number }, tier: string) =>
    Math.round(tierBase(p) * (TIER_MULT[tier as Tier] ?? 1) * 100) / 100; // to the paisa — ₹2.40 must not become ₹2

/** What a dealer of `tier` pays per unit: their saved price-list row, else the default. */
export function tierUnitPrice(rows: { productId: any; tier: string; price: number }[], p: any, tier: string): number {
    const row = rows.find((r) => String(r.productId) === String(p._id) && r.tier === tier);
    return row ? row.price : defaultTierPrice(p, tier);
}

/**
 * Price a dealer's order/quote lines at their tier (no stock check). GST follows
 * each product's `priceIncludesGst` flag — wholesale products default to GST on top.
 */
export async function priceDealerItems(businessId: any, dealer: { tier: DealerTier }, items: any[]) {
    const ids = items.map((i: any) => i.productId);
    const [products, priceRows] = await Promise.all([
        Product.find({ _id: { $in: ids }, businessId, isActive: true }),
        PriceList.find({ businessId, productId: { $in: ids }, tier: dealer.tier }).lean(),
    ]);
    const map = new Map(products.map((p) => [String(p._id), p]));
    const rows = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = lineQty(i.quantity, p);
        return { p, qty, unitPrice: tierUnitPrice(priceRows, p, dealer.tier) };
    });
    const priced = priceLines(
        rows.map((r) => ({ unitPrice: r.unitPrice, quantity: r.qty, gstRate: r.p.gstRate || 0, inclusive: r.p.priceIncludesGst === true }))
    );
    const lineItems = rows.map((r, k) => ({
        productId: r.p._id, name: r.p.name, hsn: r.p.hsn, unit: r.p.unit, quantity: r.qty, gstRate: r.p.gstRate || 0, ...priced.lines[k],
    }));
    return { lineItems, subtotal: priced.subtotal, totalGst: priced.totalGst, grandTotal: priced.grandTotal };
}

export interface DealerDue {
    _id: Types.ObjectId;
    due: number;
    orders: number;
}

const PAY_MODES = ['cash', 'upi', 'bank', 'cheque', 'other'] as const;

/**
 * Money taken when an order is created (an advance) is real money in, so it
 * gets a Payment row like any later collection — otherwise the Payments ledger
 * and the account tally miss it while the dashboard (order.paidAmount) counts it.
 */
export async function recordAdvancePayment(
    order: { _id: any; businessId: any; dealerId: any; dealerName?: string; orderNo: string },
    amount: number,
    mode?: string,
    collectedBy?: unknown
) {
    if (!(amount > 0)) return;
    await Payment.create({
        businessId: order.businessId,
        dealerId: order.dealerId,
        dealerName: order.dealerName,
        orderId: order._id,
        orderNo: order.orderNo,
        amount,
        mode: ((PAY_MODES as readonly string[]).includes(String(mode)) ? mode : 'cash') as PaymentMode,
        note: 'Advance with order',
        ...(collectedBy ? { collectedBy: new Types.ObjectId(String(collectedBy)) } : {}),
    });
}

const r2 = (n: number) => Math.round((+n || 0) * 100) / 100;

/** What one dealer owes now (live order dues, cancelled orders excluded). */
export async function dealerDue(bId: Types.ObjectId, dealerId: unknown): Promise<number> {
    const rows = await Order.aggregate([
        { $match: { businessId: bId, dealerId: new Types.ObjectId(String(dealerId)), dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, due: { $sum: '$dueAmount' } } },
    ]);
    return r2(rows[0]?.due || 0);
}

/**
 * Credit limit (0 = no limit): would `adding` more due take the dealer over it?
 * A sales rep is stopped; the owner / manager gets a 409 (code OVER_CREDIT_LIMIT)
 * and can save anyway by sending `overLimitOk: true`.
 */
export async function checkCreditLimit(
    user: { role?: string } | undefined,
    body: any,
    bId: Types.ObjectId,
    dealer: { _id: unknown; name: string; creditLimit?: number },
    adding: number
): Promise<void> {
    const limit = Number(dealer.creditLimit) || 0;
    if (limit <= 0 || !(adding > 0)) return;
    const after = r2((await dealerDue(bId, dealer._id)) + adding);
    if (after <= limit + 0.005) return;
    const over = r2(after - limit);
    if (user?.role === 'salesStaff') throw AppError.badRequest(`This takes ${dealer.name} over their credit limit of ₹${limit} by ₹${over} — ask the owner`);
    if (body?.overLimitOk !== true) throw new AppError(`This takes ${dealer.name} over their credit limit of ₹${limit} by ₹${over}.`, 409, 'OVER_CREDIT_LIMIT');
}

/** A sales rep may act only on the dealers assigned to them (owner / manager: any). */
export function assertRepDealer(user: { _id?: unknown; role?: string } | undefined, dealer: { assignedRepId?: unknown }): void {
    if (user?.role === 'salesStaff' && String(dealer.assignedRepId || '') !== String(user._id)) {
        throw AppError.forbidden('This dealer is looked after by another sales rep');
    }
}

/**
 * Spread a received amount over a dealer's unpaid orders, oldest first. Each
 * order is updated in one atomic step that only applies while its due still
 * covers the amount, so two collections at once can't both count against the
 * same due. Returns what was actually applied (the Payment is written for that).
 */
export async function settleDealerOrders(businessId: Types.ObjectId, dealerId: Types.ObjectId, amount: number): Promise<number> {
    let remaining = r2(amount);
    for (let pass = 0; pass < 3 && remaining > 0; pass++) {
        const orders = await Order.find({ businessId, dealerId, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).select('dueAmount').lean();
        if (!orders.length) break;
        for (const o of orders) {
            if (remaining <= 0) break;
            const applied = r2(Math.min(o.dueAmount, remaining));
            if (await applyToOrder(businessId, o._id, applied)) remaining = r2(remaining - applied);
        }
    }
    return r2(amount - remaining);
}

/** Take `amount` off one order's due — atomically, and only if the due still covers it. */
export async function applyToOrder(businessId: unknown, orderId: unknown, amount: number) {
    const r = await Order.updateOne(
        { _id: orderId, businessId, status: { $ne: 'cancelled' }, dueAmount: { $gte: amount - 0.005 } } as any,
        [{ $set: { paidAmount: { $round: [{ $add: ['$paidAmount', amount] }, 2] }, dueAmount: { $max: [0, { $round: [{ $subtract: ['$dueAmount', amount] }, 2] }] } } }],
        { updatePipeline: true }
    );
    return r.modifiedCount === 1;
}

/** Outstanding grouped per dealer, from live order dues (only dealers who owe). Cancelled orders excluded. */
export async function duesByDealer(bId: Types.ObjectId): Promise<DealerDue[]> {
    return Order.aggregate([
        { $match: { businessId: bId, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$dealerId', due: { $sum: '$dueAmount' }, orders: { $sum: 1 } } },
    ]);
}

/**
 * Which rep an order counts for (commission, rep stats): the sales rep who
 * took it; if the owner / manager entered it, the dealer's assigned rep.
 */
export const orderRepId = (user: { _id?: unknown; role?: string } | undefined, dealer: { assignedRepId?: Types.ObjectId }) =>
    user?.role === 'salesStaff' ? (user._id as Types.ObjectId) : dealer.assignedRepId;
