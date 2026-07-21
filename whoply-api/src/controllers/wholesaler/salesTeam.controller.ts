import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf, monthStart } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import User from '../../models/User.js';
import Visit from '../../models/Visit.js';
import Order from '../../models/Order.js';
import Dealer from '../../models/Dealer.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

/** POST /sales-team — add a sales rep (creates a salesStaff user in this business) */
export const createRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { name, mobile } = req.body;
    if (!name || !mobile) throw AppError.badRequest('name and mobile are required');
    const normalized = normalizePhone(mobile);
    const exists = await User.findOne({ mobile: normalized });
    if (exists) throw AppError.conflict('A user with this mobile already exists');
    const rep = await User.create({
        name,
        mobile: normalized,
        role: 'salesStaff',
        businessId,
        salary: Number(req.body.salary) || 0,
        kyc: req.body.kyc || {},
        ...(req.body.password && { password: req.body.password }),
    });
    sendCreated(res, { _id: rep._id, name: rep.name, mobile: rep.mobile, salary: rep.salary });
});

/** PATCH /sales-team/:id */
export const updateRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = {};
    if (req.body.name) patch.name = req.body.name;
    if (req.body.isActive !== undefined) patch.isActive = req.body.isActive;
    const rep = await User.findOneAndUpdate({ _id: req.params.id, businessId, role: 'salesStaff' }, patch, { new: true });
    if (!rep) throw AppError.notFound('Sales rep not found');
    sendSuccess(res, { _id: rep._id, name: rep.name, mobile: rep.mobile, isActive: rep.isActive }, 'Sales rep updated');
});

/** DELETE /sales-team/:id */
export const deleteRep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const rep = await User.findOneAndUpdate({ _id: req.params.id, businessId, role: 'salesStaff' }, { isActive: false }, { new: true });
    if (!rep) throw AppError.notFound('Sales rep not found');
    sendSuccess(res, { ok: true }, 'Sales rep removed');
});

/** GET /sales-team — reps with this month's visit & order stats + commission (2%) */
export const listReps = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const reps = await User.find({ businessId, role: 'salesStaff', isActive: true }).lean();

    const enriched = await Promise.all(
        reps.map(async (r) => {
            const [visits, orderAgg] = await Promise.all([
                Visit.countDocuments({ businessId: bId, salesRepId: r._id, visitedAt: { $gte: monthStart() } }),
                Order.aggregate([
                    { $match: { businessId: bId, salesRepId: r._id, createdAt: { $gte: monthStart() } } },
                    { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$total' } } },
                ]),
            ]);
            const sales = orderAgg[0]?.sales || 0;
            return {
                _id: r._id,
                name: r.name,
                mobile: r.mobile,
                visits,
                orders: orderAgg[0]?.count || 0,
                sales,
                commission: +(sales * 0.02).toFixed(2),
            };
        })
    );
    sendSuccess(res, enriched);
});

/** GET /sales-team/visits — recent field visits */
export const listVisits = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const visits = await Visit.find({ businessId }).sort({ visitedAt: -1 }).limit(50).lean();
    sendSuccess(res, visits);
});

/** POST /sales-team/visits — record a visit */
export const recordVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { salesRepId, dealerId, outcome = 'no_order', note } = req.body;
    if (!salesRepId || !dealerId) throw AppError.badRequest('salesRepId and dealerId are required');
    const [rep, dealer] = await Promise.all([
        User.findOne({ _id: salesRepId, businessId }).lean(),
        Dealer.findOne({ _id: dealerId, businessId }).lean(),
    ]);
    if (!rep || !dealer) throw AppError.badRequest('Rep or dealer not found');
    const visit = await Visit.create({
        businessId,
        salesRepId,
        salesRepName: rep.name,
        dealerId,
        dealerName: dealer.name,
        outcome,
        note,
    });
    sendCreated(res, visit);
});
