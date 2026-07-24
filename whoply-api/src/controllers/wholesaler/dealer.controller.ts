import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Payment, { type PaymentMode } from '../../models/Payment.js';
import { settleDealerOrders } from './payment.controller.js';
import { duesByDealer } from '../../utils/wholesaler.js';
import { Types } from 'mongoose';
import type { AuthRequest } from '../../interfaces/index.js';

const MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'cheque', 'other'];

export const listDealers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    if (req.query.search) filter.name = { $regex: String(req.query.search), $options: 'i' };
    if (req.query.tier) filter.tier = req.query.tier;

    // Outstanding is derived from live order dues (source of truth), not the stored counter.
    const [all, dues] = await Promise.all([Dealer.find(filter).lean(), duesByDealer(bId)]);
    const dueMap = new Map(dues.map((d) => [String(d._id), d.due]));
    let rows = all.map((d) => ({ ...d, outstandingBalance: dueMap.get(String(d._id)) || 0 }));
    if (req.query.hasDue === 'true') rows = rows.filter((d) => d.outstandingBalance > 0);
    rows.sort((a, b) => b.outstandingBalance - a.outstandingBalance || a.name.localeCompare(b.name));
    const total = rows.length;
    sendPaginated(res, rows.slice(skip, skip + limit), meta(total));
});

export const createDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (!req.body.name) throw AppError.badRequest('name is required');
    const dealer = await Dealer.create({ ...req.body, businessId });
    sendCreated(res, dealer);
});

export const updateDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = {};
    ['name', 'shopName', 'mobile', 'tier', 'city', 'creditLimit', 'assignedRepId'].forEach((k) => {
        if (req.body[k] !== undefined) patch[k] = req.body[k];
    });
    const dealer = await Dealer.findOneAndUpdate({ _id: req.params.id, businessId }, patch, { new: true });
    if (!dealer) throw AppError.notFound('Dealer not found');
    sendSuccess(res, dealer, 'Dealer updated');
});

export const deleteDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const dealer = await Dealer.findOneAndUpdate({ _id: req.params.id, businessId }, { isActive: false }, { new: true });
    if (!dealer) throw AppError.notFound('Dealer not found');
    sendSuccess(res, { ok: true }, 'Dealer removed');
});

export const dealerOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const dealer = await Dealer.findOne({ _id: req.params.id, businessId }).lean();
    if (!dealer) throw AppError.notFound('Dealer not found');
    const orders = await Order.find({ businessId, dealerId: dealer._id }).sort({ createdAt: -1 }).limit(50).lean();
    sendSuccess(res, { dealer, orders });
});

/**
 * POST /dealers/:id/collect — record a payment against a dealer's outstanding.
 * The amount is applied across the dealer's unpaid orders (oldest first) so those
 * orders stop showing as "due", and a Payment is logged for the money-in ledger.
 */
export const collectPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) throw AppError.badRequest('A positive amount is required');
    const dealer = await Dealer.findOne({ _id: req.params.id, businessId });
    if (!dealer) throw AppError.notFound('Dealer not found');

    // Clamp to what the dealer actually owes (sum of live order dues) so the money-in
    // ledger can never exceed what was billed. Advances aren't tracked yet.
    const dues = await duesByDealer(bId);
    const owed = dues.find((d) => String(d._id) === String(dealer._id))?.due || 0;
    const applied = +Math.min(amount, owed).toFixed(2);
    if (applied <= 0) throw AppError.badRequest('This dealer has no outstanding to collect');

    await settleDealerOrders(bId, dealer._id, applied);

    const payment = await Payment.create({
        businessId: bId,
        dealerId: dealer._id,
        dealerName: dealer.name,
        amount: applied,
        mode: (MODES.includes(req.body.mode) ? req.body.mode : 'cash') as PaymentMode,
        note: req.body.note,
    });
    sendSuccess(res, { dealer, payment, applied }, 'Payment collected');
});
