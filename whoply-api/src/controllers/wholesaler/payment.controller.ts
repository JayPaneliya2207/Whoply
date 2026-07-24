import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Payment, { type PaymentMode } from '../../models/Payment.js';
import { duesByDealer } from '../../utils/wholesaler.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

const MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'cheque', 'other'];
const normMode = (m: any): PaymentMode => (MODES.includes(m) ? m : 'cash');

type Period = 'week' | 'month' | 'quarter' | 'year';
/** Start of the selected reporting window (rolling: last week / month / quarter / year). */
const periodStart = (period: Period): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'quarter') d.setMonth(d.getMonth() - 3);
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1); // month (default)
    return d;
};

/**
 * Apply a received amount across a dealer's unpaid orders, oldest first (FIFO).
 * Keeps every order's paidAmount/dueAmount in sync with what was actually collected,
 * so an order never shows "due" after the dealer has cleared it.
 */
export async function settleDealerOrders(businessId: Types.ObjectId, dealerId: Types.ObjectId, amount: number) {
    let remaining = +amount.toFixed(2);
    if (remaining <= 0) return;
    const orders = await Order.find({ businessId, dealerId, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } }).sort({ createdAt: 1 });
    for (const o of orders) {
        if (remaining <= 0) break;
        const applied = Math.min(o.dueAmount, remaining);
        o.paidAmount = +(o.paidAmount + applied).toFixed(2);
        o.dueAmount = +(o.dueAmount - applied).toFixed(2);
        remaining = +(remaining - applied).toFixed(2);
        await o.save();
    }
}

/**
 * POST /orders/:id/collect — record a payment against one order.
 * Updates the order, reduces the dealer's outstanding balance, and logs a Payment.
 */
export const recordOrderPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) throw AppError.badRequest('A positive amount is required');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');
    if (order.status === 'cancelled') throw AppError.badRequest('Cannot collect on a cancelled order');
    const pay = Math.min(amount, order.dueAmount);
    if (pay <= 0) throw AppError.badRequest('This order is already fully paid');

    order.paidAmount = +(order.paidAmount + pay).toFixed(2);
    order.dueAmount = +(order.dueAmount - pay).toFixed(2);
    await order.save();
    // Dealer outstanding is derived from order dues — updating the order above is enough.

    const payment = await Payment.create({
        businessId: bId,
        dealerId: order.dealerId,
        dealerName: order.dealerName,
        orderId: order._id,
        orderNo: order.orderNo,
        amount: pay,
        mode: normMode(req.body.mode),
        note: req.body.note,
    });
    sendCreated(res, { order, payment });
});

/** GET /payments — money-in ledger (newest first), optional dealer/mode filter */
export const listPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.dealerId) filter.dealerId = req.query.dealerId;
    if (req.query.mode) filter.mode = req.query.mode;
    const [items, total] = await Promise.all([
        Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Payment.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/**
 * GET /reports/tally?period=week|month|quarter|year — wholesaler account tally.
 * All-time standing (billed / collected / outstanding) plus money-in for the
 * selected period (total, count, split by mode), billed in the period, and the
 * dealers who owe the most.
 */
export const tallyReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const period = (['week', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? req.query.period : 'month') as Period;
    const since = periodStart(period);

    const [billedAgg, dues, periodIn, periodBilled, recentPayments] = await Promise.all([
        Order.aggregate([
            { $match: { businessId: bId } },
            { $group: { _id: null, billed: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' }, orders: { $sum: 1 } } },
        ]),
        duesByDealer(bId),
        Payment.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since } } },
            { $group: { _id: '$mode', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since } } },
            { $group: { _id: null, billed: { $sum: '$total' }, orders: { $sum: 1 } } },
        ]),
        Payment.find({ businessId: bId }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const b = billedAgg[0] || { billed: 0, paid: 0, due: 0, orders: 0 };
    const byMode: Record<string, number> = {};
    let periodCollected = 0;
    let periodPayments = 0;
    periodIn.forEach((m) => { byMode[m._id] = m.total; periodCollected += m.total; periodPayments += m.count; });

    // Top debtors from live order dues, joined with dealer info.
    const outstanding = dues.reduce((s, d) => s + d.due, 0);
    const topDues = [...dues].sort((a, b) => b.due - a.due).slice(0, 8);
    const debtorDealers = await Dealer.find({ businessId: bId, _id: { $in: topDues.map((d) => d._id) } }).lean();
    const dInfo = new Map(debtorDealers.map((d) => [String(d._id), d]));
    const topDebtors = topDues.map((td) => {
        const d = dInfo.get(String(td._id));
        return { _id: td._id, name: d?.name || 'Dealer', city: d?.city, mobile: d?.mobile, outstanding: td.due };
    });

    sendSuccess(res, {
        period,
        totalBilled: b.billed,
        totalCollected: b.paid,
        orderDue: b.due,
        orderCount: b.orders,
        outstanding,
        outstandingDealers: dues.length,
        periodCollected,
        periodPayments,
        periodBilled: periodBilled[0]?.billed || 0,
        periodOrders: periodBilled[0]?.orders || 0,
        byMode,
        topDebtors,
        recentPayments,
    });
});
