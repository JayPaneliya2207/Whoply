import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Payment, { type PaymentMode } from '../../models/Payment.js';
import { duesByDealer, dealerDue, settleDealerOrders, assertRepDealer } from '../../utils/wholesaler.js';
import { cleanGstin } from '../../utils/gstin.js';
import { Types } from 'mongoose';
import type { AuthRequest } from '../../interfaces/index.js';
import { containsText } from '../../utils/search.js';
import { normalizePhone } from '../../utils/phone.js';
import { can } from '../../utils/permissions.js';
import User from '../../models/User.js';

const MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'cheque', 'other'];

export const listDealers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    if (req.query.search) filter.name = containsText(req.query.search);
    if (req.query.tier) filter.tier = req.query.tier;
    if (req.query.mine === 'true') filter.assignedRepId = req.user?._id; // a rep's own dealers

    // Outstanding is derived from live order dues (source of truth), not the stored counter.
    const [all, dues, reps] = await Promise.all([
        Dealer.find(filter).lean(),
        duesByDealer(bId),
        User.find({ businessId, role: 'salesStaff' }).select('name').lean(),
    ]);
    const dueMap = new Map(dues.map((d) => [String(d._id), d.due]));
    const repName = new Map(reps.map((r) => [String(r._id), r.name]));
    let rows = all.map((d) => ({
        ...d,
        outstandingBalance: dueMap.get(String(d._id)) || 0,
        assignedRepName: d.assignedRepId ? repName.get(String(d.assignedRepId)) : undefined,
    }));
    if (req.query.hasDue === 'true') rows = rows.filter((d) => d.outstandingBalance > 0);
    rows.sort((a, b) => b.outstandingBalance - a.outstandingBalance || a.name.localeCompare(b.name));
    const total = rows.length;
    sendPaginated(res, rows.slice(skip, skip + limit), meta(total));
});

/**
 * The dealer fields a client may set, validated. Balances are never taken from
 * the client (outstanding comes from order dues). Only the owner / manager
 * (team.view) choose the dealer's sales rep; a rep who adds a dealer gets it.
 */
async function dealerFields(req: AuthRequest, opts: { create: boolean }) {
    const b = req.body || {};
    const out: Record<string, any> = {};
    const unset: Record<string, 1> = {};
    const text = (k: string, max: number, required = false) => {
        if (!opts.create && b[k] === undefined) return;
        const v = String(b[k] ?? '').trim();
        if (required && !v) throw AppError.badRequest('Name is required');
        if (v.length > max) throw AppError.badRequest(`${k} is too long (${max} characters max)`);
        out[k] = v;
    };
    text('name', 80, true);
    text('shopName', 80);
    text('city', 60);
    if (b.countryCode !== undefined) out.countryCode = /^\+\d{1,4}$/.test(String(b.countryCode)) ? String(b.countryCode) : '+91';
    if (b.mobile !== undefined) {
        const cc = out.countryCode || '+91';
        const mobile = cc === '+91' ? normalizePhone(b.mobile) : String(b.mobile).replace(/\D/g, '');
        if (mobile && !(cc === '+91' ? /^[6-9]\d{9}$/ : /^\d{6,15}$/).test(mobile)) throw AppError.badRequest('Enter a valid mobile number');
        if (mobile) out.mobile = mobile; else unset.mobile = 1;
    }
    if (b.gstin !== undefined) out.gstin = cleanGstin(b.gstin, (m) => AppError.badRequest(m)) ?? '';
    // Price group and credit limit decide money — the owner / manager (team.view) set them;
    // a sales rep's form values are ignored (new dealers get the defaults).
    if (can(req.user?.role, 'team.view')) {
        if (b.tier !== undefined) {
            if (!['A', 'B', 'C'].includes(b.tier)) throw AppError.badRequest('Price group must be A, B or C');
            out.tier = b.tier;
        }
        if (b.creditLimit !== undefined && b.creditLimit !== '') {
            const n = Number(b.creditLimit);
            if (!Number.isFinite(n) || n < 0) throw AppError.badRequest('Credit limit must be 0 or more');
            out.creditLimit = n;
        }
    }
    if (can(req.user?.role, 'team.view')) {
        if (b.assignedRepId !== undefined) {
            if (!b.assignedRepId) unset.assignedRepId = 1;
            else {
                const rep = await User.findOne({ _id: b.assignedRepId, businessId: businessOf(req), role: 'salesStaff', isActive: true }).select('_id').lean();
                if (!rep) throw AppError.badRequest('Pick one of your sales reps');
                out.assignedRepId = rep._id;
            }
        }
    } else if (opts.create && req.user?.role === 'salesStaff') {
        out.assignedRepId = req.user._id; // the rep who found the dealer looks after them
    }
    return { out, unset };
}

export const createDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { out } = await dealerFields(req, { create: true });
    const dealer = await Dealer.create({ ...out, businessId });
    sendCreated(res, dealer);
});

export const updateDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { out, unset } = await dealerFields(req, { create: false });
    // A sales rep may edit only the dealers assigned to them.
    const current = await Dealer.findOne({ _id: req.params.id, businessId, isActive: true }).select('assignedRepId').lean();
    if (!current) throw AppError.notFound('Dealer not found');
    assertRepDealer(req.user, current);
    const mine = req.user?.role === 'salesStaff' ? { assignedRepId: req.user._id } : {};
    const dealer = await Dealer.findOneAndUpdate(
        { _id: req.params.id, businessId, isActive: true, ...mine },
        { $set: out, ...(Object.keys(unset).length && { $unset: unset }) },
        { new: true }
    );
    if (!dealer) throw AppError.notFound('Dealer not found');
    sendSuccess(res, dealer, 'Dealer updated');
});

/** DELETE /dealers/:id — refused while the dealer still owes money (their dues would drop out of the Dealers list). */
export const deleteDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const existing = await Dealer.findOne({ _id: req.params.id, businessId, isActive: true }).select('assignedRepId').lean();
    if (!existing) throw AppError.notFound('Dealer not found');
    assertRepDealer(req.user, existing);
    const owed = await dealerDue(bId, existing._id);
    if (owed > 0) throw AppError.badRequest(`This dealer still owes ₹${owed} — collect it (or cancel those orders) first`);
    const dealer = await Dealer.findOneAndUpdate({ _id: existing._id, businessId }, { isActive: false }, { new: true });
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
    assertRepDealer(req.user, dealer);

    // Never more than the dealer owes — advances aren't tracked, so extra money would vanish.
    const owed = await dealerDue(bId, dealer._id);
    if (owed <= 0) throw AppError.badRequest('This dealer has no outstanding to collect');
    if (amount > owed + 0.005) throw AppError.badRequest(`₹${+amount.toFixed(2)} is more than the ₹${owed} this dealer owes`);

    // Applied order by order, atomically; the Payment is written for what really went in.
    const applied = await settleDealerOrders(bId, dealer._id, +amount.toFixed(2));
    if (applied <= 0) throw AppError.conflict('The dealer\'s dues changed while you were collecting — try again');

    const payment = await Payment.create({
        businessId: bId,
        dealerId: dealer._id,
        dealerName: dealer.name,
        amount: applied,
        mode: (MODES.includes(req.body.mode) ? req.body.mode : 'cash') as PaymentMode,
        note: req.body.note,
        collectedBy: req.user?._id,
    });
    sendSuccess(res, { dealer, payment, applied }, 'Payment collected');
});
