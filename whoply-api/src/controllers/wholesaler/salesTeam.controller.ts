import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf, monthStart } from '../../utils/http.js';
import { passwordSchema } from '../../validators/common.validator.js';
import { sanitizeKyc } from '../../utils/kyc.js';
import User from '../../models/User.js';
import Visit from '../../models/Visit.js';
import Order from '../../models/Order.js';
import Dealer from '../../models/Dealer.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { can } from '../../utils/permissions.js';
import { Types } from 'mongoose';
import { staffFields, findRehire, endSessions } from '../../utils/staff.js';

/** POST /sales-team — add a sales rep (creates a salesStaff user in this business) */
export const createRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (req.body.password) passwordSchema.parse(req.body.password);
    const fields = staffFields(req.body, true);
    // A rep removed earlier, added again with the same mobile, gets their login back.
    const back = await findRehire(fields.mobile, businessId);
    let rep;
    if (back) {
        Object.assign(back, fields, { role: 'salesStaff', isActive: true, kyc: sanitizeKyc(req.body.kyc) });
        if (req.body.password) back.password = req.body.password;
        rep = await back.save();
    } else rep = await User.create({
        ...fields,
        role: 'salesStaff',
        businessId,
        kyc: sanitizeKyc(req.body.kyc), // Aadhaar: last 4 digits only, no photo
        ...(req.body.password && { password: req.body.password }),
    });
    sendCreated(res, { _id: rep._id, name: rep.name, mobile: rep.mobile, salary: rep.salary });
});

/** PATCH /sales-team/:id */
export const updateRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = staffFields({ name: req.body.name }, false);
    if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
    const rep = await User.findOneAndUpdate({ _id: req.params.id, businessId, role: 'salesStaff' }, patch, { new: true, runValidators: true });
    if (!rep) throw AppError.notFound('Sales rep not found');
    if (patch.isActive === false) await endSessions(rep._id);
    sendSuccess(res, { _id: rep._id, name: rep.name, mobile: rep.mobile, isActive: rep.isActive }, 'Sales rep updated');
});

/** DELETE /sales-team/:id */
export const deleteRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const rep = await User.findOneAndUpdate({ _id: req.params.id, businessId, role: 'salesStaff' }, { isActive: false }, { new: true });
    if (!rep) throw AppError.notFound('Sales rep not found');
    await endSessions(rep._id);
    sendSuccess(res, { ok: true }, 'Sales rep removed');
});

/** Commission a rep earns: this share of their orders' value before GST. */
export const COMMISSION_PCT = 2;

/**
 * GET /sales-team — each rep's month (IST): visits, orders, sales before GST
 * and commission, plus how many dealers they look after. Owner / manager see
 * every rep; a sales rep sees only themselves. Cancelled orders don't count.
 */
export const listReps = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const repFilter: any = { businessId, role: 'salesStaff', isActive: true };
    if (!can(req.user?.role, 'team.view')) repFilter._id = req.user?._id;
    const reps = await User.find(repFilter).select('name mobile').lean();
    const ids = reps.map((r) => r._id);
    const since = monthStart();

    const [visitAgg, orderAgg, dealerAgg] = await Promise.all([
        Visit.aggregate([
            { $match: { businessId: bId, salesRepId: { $in: ids }, visitedAt: { $gte: since } } },
            { $group: { _id: '$salesRepId', n: { $sum: 1 } } },
        ]),
        Order.aggregate([
            { $match: { businessId: bId, salesRepId: { $in: ids }, status: { $ne: 'cancelled' }, createdAt: { $gte: since } } },
            // subtotal = value before GST; very old orders without it fall back to total
            { $group: { _id: '$salesRepId', count: { $sum: 1 }, sales: { $sum: { $ifNull: ['$subtotal', '$total'] } } } },
        ]),
        Dealer.aggregate([
            { $match: { businessId: bId, isActive: true, assignedRepId: { $in: ids } } },
            { $group: { _id: '$assignedRepId', n: { $sum: 1 } } },
        ]),
    ]);
    const by = <T>(rows: any[], f: (x: any) => T) => new Map(rows.map((x) => [String(x._id), f(x)]));
    const visits = by(visitAgg, (x) => x.n);
    const orders = by(orderAgg, (x) => x);
    const dealers = by(dealerAgg, (x) => x.n);

    sendSuccess(res, reps.map((r) => {
        const o = orders.get(String(r._id));
        const sales = +(o?.sales || 0).toFixed(2);
        return {
            _id: r._id,
            name: r.name,
            mobile: r.mobile,
            dealers: dealers.get(String(r._id)) || 0,
            visits: visits.get(String(r._id)) || 0,
            orders: o?.count || 0,
            sales,
            commission: +((sales * COMMISSION_PCT) / 100).toFixed(2),
            commissionPct: COMMISSION_PCT,
        };
    }));
});

/** GET /sales-team/visits?dealerId= — recent field visits (a rep sees only their own). */
export const listVisits = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const filter: any = { businessId };
    if (!can(req.user?.role, 'team.view')) filter.salesRepId = req.user?._id;
    if (req.query.dealerId && Types.ObjectId.isValid(String(req.query.dealerId))) filter.dealerId = req.query.dealerId;
    const visits = await Visit.find(filter).sort({ visitedAt: -1 }).limit(50).lean();
    sendSuccess(res, visits);
});

const OUTCOMES = ['order', 'no_order', 'follow_up'] as const;

/**
 * POST /sales-team/visits — log a visit to a dealer.
 * body: { dealerId, outcome: 'order' | 'no_order' | 'follow_up', note?, salesRepId? }
 * A rep logs their own; the owner / manager may log one for a rep (salesRepId).
 */
export const recordVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId } = req.body;
    const outcome = req.body.outcome ?? 'no_order';
    if (!OUTCOMES.includes(outcome)) throw AppError.badRequest('Outcome must be order, no_order or follow_up');
    const note = String(req.body.note ?? '').trim();
    if (note.length > 200) throw AppError.badRequest('Note is too long (200 characters max)');
    const salesRepId = can(req.user?.role, 'team.view') ? req.body.salesRepId : req.user?._id;
    if (!salesRepId || !dealerId) throw AppError.badRequest('Pick the dealer and the sales rep');
    const [rep, dealer] = await Promise.all([
        User.findOne({ _id: salesRepId, businessId, role: 'salesStaff', isActive: true }).lean(),
        Dealer.findOne({ _id: dealerId, businessId, isActive: true }).lean(),
    ]);
    if (!rep) throw AppError.badRequest('Pick one of your sales reps');
    if (!dealer) throw AppError.badRequest('Dealer not found');
    const visit = await Visit.create({
        businessId,
        salesRepId: rep._id,
        salesRepName: rep.name,
        dealerId: dealer._id,
        dealerName: dealer.name,
        outcome,
        note: note || undefined,
    });
    sendCreated(res, visit);
});
