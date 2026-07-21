import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import Invoice from '../../models/Invoice.js';
import Product from '../../models/Product.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** GET /admin/stats — platform-wide KPIs */
export const platformStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [businesses, retail, wholesale, users, invoices, gmvAgg, planAgg] = await Promise.all([
        Business.countDocuments({}),
        Business.countDocuments({ type: 'retail' }),
        Business.countDocuments({ type: 'wholesale' }),
        User.countDocuments({ role: { $ne: 'admin' } }),
        Invoice.countDocuments({}),
        Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
        Business.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
    ]);
    sendSuccess(res, {
        businesses,
        retail,
        wholesale,
        users,
        invoices,
        gmv: gmvAgg[0]?.total || 0,
        plans: planAgg.map((p) => ({ plan: p._id, count: p.count })),
    });
});

/** GET /admin/businesses — all tenants */
export const listBusinesses = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) filter.name = { $regex: String(req.query.search), $options: 'i' };

    const [items, total] = await Promise.all([
        Business.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Business.countDocuments(filter),
    ]);

    // enrich with counts
    const enriched = await Promise.all(
        items.map(async (b) => {
            const [productCount, invoiceCount] = await Promise.all([
                Product.countDocuments({ businessId: b._id }),
                Invoice.countDocuments({ businessId: b._id }),
            ]);
            return { ...b, productCount, invoiceCount };
        })
    );
    sendPaginated(res, enriched, meta(total));
});

/** GET /admin/users — all users across tenants */
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const [items, total] = await Promise.all([
        User.find({}).populate('businessId', 'name type').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments({}),
    ]);
    sendPaginated(res, items, meta(total));
});

/** PATCH /admin/businesses/:id — toggle active / change plan */
export const updateBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const allowed: any = {};
    if (typeof req.body.isActive === 'boolean') allowed.isActive = req.body.isActive;
    if (req.body.plan) allowed.plan = req.body.plan;
    const business = await Business.findByIdAndUpdate(req.params.id, allowed, { new: true });
    sendSuccess(res, business, 'Business updated');
});
