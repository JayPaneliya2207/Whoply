/**
 * One-off data fixes shared by `migrate` (existing databases) and `seed` (so a
 * fresh demo database looks like one the current code produced). Every function
 * is idempotent — running it again changes nothing.
 */
import { Types } from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import CreditNote from '../models/CreditNote.js';
import CreditLedger from '../models/CreditLedger.js';
import PriceList from '../models/PriceList.js';
import Product from '../models/Product.js';
import { defaultTierPrice } from '../utils/wholesaler.js';
import User from '../models/User.js';
import { sanitizeKyc } from '../utils/kyc.js';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Orders used to store an advance (paidAmount at creation) without a Payment
 * row, so the Payments ledger showed less than the dashboard. For each dealer,
 * whatever of an order's paidAmount isn't explained by its own payments — nor,
 * oldest orders first, by dealer-level collections (which settle oldest dues
 * first) — was an advance: record it, dated when the order was created.
 */
export async function backfillOrderAdvances(): Promise<number> {
    const orders = await Order.find({ paidAmount: { $gt: 0 } })
        .select('businessId dealerId dealerName orderNo paidAmount createdAt')
        .sort({ createdAt: 1 })
        .lean();
    if (!orders.length) return 0;

    const payments = await Payment.find({ dealerId: { $in: [...new Set(orders.map((o) => String(o.dealerId)))] } })
        .select('dealerId orderId amount')
        .lean();
    const byOrder = new Map<string, number>();
    const dealerLevel = new Map<string, number>();
    for (const p of payments) {
        if (p.orderId) byOrder.set(String(p.orderId), (byOrder.get(String(p.orderId)) || 0) + p.amount);
        else dealerLevel.set(String(p.dealerId), (dealerLevel.get(String(p.dealerId)) || 0) + p.amount);
    }

    const rows: any[] = [];
    for (const o of orders) {
        let gap = r2(o.paidAmount - (byOrder.get(String(o._id)) || 0));
        if (gap <= 0.005) continue;
        const pool = dealerLevel.get(String(o.dealerId)) || 0;
        const fromPool = Math.min(gap, pool);
        dealerLevel.set(String(o.dealerId), r2(pool - fromPool));
        gap = r2(gap - fromPool);
        if (gap <= 0.005) continue;
        // Raw insert so the payment keeps the order's date (Mongoose timestamps would stamp "now").
        rows.push({
            _id: new Types.ObjectId(), businessId: o.businessId, dealerId: o.dealerId, dealerName: o.dealerName,
            orderId: o._id, orderNo: o.orderNo, amount: gap, mode: 'cash', note: 'Advance with order',
            createdAt: o.createdAt, updatedAt: o.createdAt,
        });
    }
    if (rows.length) await Payment.collection.insertMany(rows);
    return rows.length;
}

/**
 * Staff ID details used to be stored as entered — full Aadhaar numbers and
 * photos of the card. Re-clean every stored KYC with the current rule
 * (utils/kyc.ts): Aadhaar keeps only its last 4 digits and no photo.
 */
export async function maskStoredAadhaar(): Promise<number> {
    const users = await User.find({ kyc: { $exists: true } }).select('kyc').lean();
    const ops = users
        .map((u: any) => ({ u, clean: sanitizeKyc(u.kyc) }))
        .filter(({ u, clean }) => clean.docType === 'aadhaar' && (u.kyc?.docNumber !== clean.docNumber || u.kyc?.docType !== 'aadhaar' || (u.kyc?.documents || []).length > 0))
        .map(({ u, clean }) => ({ updateOne: { filter: { _id: u._id }, update: { $set: { kyc: clean } } } }));
    if (ops.length) await User.bulkWrite(ops);
    return ops.length;
}

/**
 * Udhar reduced by a return used to be logged as a 'repayment', so day-close
 * counted it as money collected. Relabel those rows as 'return'.
 */
export async function relabelReturnLedgerRows(): Promise<number> {
    const r = await CreditLedger.updateMany({ type: 'repayment', refType: 'CreditNote' }, { $set: { type: 'return' } });
    return r.modifiedCount;
}

/**
 * Retail credit notes didn't store how much cash was handed back, so day-close
 * couldn't subtract it. Cash-mode notes refunded their whole value; udhar_adjust
 * notes refunded whatever their ledger row didn't absorb.
 */
export async function backfillCashRefunds(): Promise<number> {
    const notes = await CreditNote.find({ invoiceId: { $exists: true, $ne: null }, $or: [{ cashRefund: { $exists: false } }, { cashRefund: 0 }] })
        .select('refundMode total')
        .lean();
    if (!notes.length) return 0;
    const ledger = await CreditLedger.find({ refType: 'CreditNote', refId: { $in: notes.map((n) => n._id) } }).select('refId amount').lean();
    const absorbed = new Map(ledger.map((l) => [String(l.refId), l.amount]));
    const ops = notes
        .map((n) => ({ n, cash: r2(n.refundMode === 'cash' ? n.total : n.total - (absorbed.get(String(n._id)) || 0)) }))
        .filter((x) => x.cash > 0)
        .map((x) => ({ updateOne: { filter: { _id: x.n._id }, update: { $set: { cashRefund: x.cash } } } }));
    if (ops.length) await CreditNote.bulkWrite(ops);
    return ops.length;
}

/**
 * Opening Price Lists used to save a row for every default tier price, which
 * then froze it: later base-price changes never reached those tiers. Defaults
 * are now computed on the fly, so drop saved rows that just equal the current
 * default. Rows that differ may be real overrides and are kept.
 */
export async function dropDefaultTierRows(): Promise<number> {
    const rows = await PriceList.find({}).select('productId tier price').lean();
    if (!rows.length) return 0;
    const products = await Product.find({ _id: { $in: [...new Set(rows.map((r) => String(r.productId)))] } })
        .select('wholesalePrice sellPrice')
        .lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const ids = rows
        .filter((r) => {
            const p = byId.get(String(r.productId));
            return p && r.price === defaultTierPrice(p, r.tier);
        })
        .map((r) => r._id);
    if (!ids.length) return 0;
    const r = await PriceList.deleteMany({ _id: { $in: ids } });
    return r.deletedCount;
}
