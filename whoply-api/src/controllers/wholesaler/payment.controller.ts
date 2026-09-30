import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Payment, { type PaymentMode } from '../../models/Payment.js';
import { duesByDealer, applyToOrder, assertRepDealer } from '../../utils/wholesaler.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';
import { istPeriodStart } from '../../utils/ist.js';

const MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'cheque', 'other'];
const normMode = (m: any): PaymentMode => (MODES.includes(m) ? m : 'cash');

type Period = 'week' | 'month' | 'quarter' | 'year';
/** Start of the selected reporting window (rolling: last week / month / quarter / year), IST. */
const periodStart = (period: Period): Date => istPeriodStart(period);

/** Orders that count as sold (a cancelled order was never a sale). */
const LIVE = { status: { $ne: 'cancelled' as const } };

/**
 * POST /orders/:id/collect — record a payment against one order.
 * Refused if more than the due (it used to be cut down silently); applied in one
 * atomic step, so two collections at once can't both count. A sales rep may only
 * collect for their own dealers. Logs a Payment with who took the money.
 */
export const recordOrderPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const pay = Math.round(Number(req.body.amount) * 100) / 100;
    if (!(pay > 0)) throw AppError.badRequest('A positive amount is required');

    const current = await Order.findOne({ _id: req.params.id, businessId }).select('dealerId status dueAmount').lean();
    if (!current) throw AppError.notFound('Order not found');
    if (current.status === 'cancelled') throw AppError.badRequest('Cannot collect on a cancelled order');
    const dealer = await Dealer.findOne({ _id: current.dealerId, businessId }).select('assignedRepId').lean();
    assertRepDealer(req.user, dealer || {});
    if (current.dueAmount <= 0) throw AppError.badRequest('This order is already fully paid');
    if (pay > current.dueAmount + 0.005) throw AppError.badRequest(`₹${pay} is more than the ₹${current.dueAmount} due on this order`);

    if (!(await applyToOrder(businessId, current._id, pay))) throw AppError.conflict('The due changed while you were collecting — open the order again');
    const order = await Order.findById(current._id);
    if (!order) throw AppError.notFound('Order not found');

    const payment = await Payment.create({
        businessId: bId,
        dealerId: order.dealerId,
        dealerName: order.dealerName,
        orderId: order._id,
        orderNo: order.orderNo,
        amount: pay,
        mode: normMode(req.body.mode),
        note: req.body.note,
        collectedBy: req.user?._id,
    });
    sendCreated(res, { order, payment });
});

/**
 * GET /payments?dealerId=&mode=&period=week|month|quarter|year&page=&limit= —
 * money-in ledger (newest first). `sum` is the total of every matching row
 * (not just this page); refunds to dealers are negative rows.
 */
export const listPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId: bId };
    if (req.query.dealerId) {
        if (!Types.ObjectId.isValid(String(req.query.dealerId))) throw AppError.badRequest('Invalid dealerId');
        filter.dealerId = new Types.ObjectId(String(req.query.dealerId));
    }
    if (req.query.mode) filter.mode = String(req.query.mode);
    if (['week', 'month', 'quarter', 'year'].includes(String(req.query.period))) filter.createdAt = { $gte: periodStart(req.query.period as Period) };
    const [items, total, sumAgg] = await Promise.all([
        Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Payment.countDocuments(filter),
        Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    ]);
    res.status(200).json({ success: true, data: { items, meta: meta(total), sum: Math.round((sumAgg[0]?.sum || 0) * 100) / 100 } });
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
            { $match: { businessId: bId, ...LIVE } },
            { $group: { _id: null, billed: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' }, orders: { $sum: 1 } } },
        ]),
        duesByDealer(bId),
        Payment.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: since } } },
            { $group: { _id: '$mode', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Order.aggregate([
            { $match: { businessId: bId, ...LIVE, createdAt: { $gte: since } } },
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
