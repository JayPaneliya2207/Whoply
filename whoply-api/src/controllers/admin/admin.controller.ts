import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import Invoice from '../../models/Invoice.js';
import Product from '../../models/Product.js';
import Plan from '../../models/Plan.js';
import { STAFF_ROLES, type AuthRequest } from '../../interfaces/index.js';

/** GET /admin/stats — platform-wide KPIs + account tally (MRR from subscriptions) */
export const platformStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [businesses, retail, wholesale, active, users, invoices, gmvAgg, planAgg, plans] = await Promise.all([
        Business.countDocuments({}),
        Business.countDocuments({ type: 'retail' }),
        Business.countDocuments({ type: 'wholesale' }),
        Business.countDocuments({ isActive: true }),
        User.countDocuments({ role: { $ne: 'admin' } }),
        Invoice.countDocuments({}),
        Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
        Business.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$plan', count: { $sum: 1 } } }]),
        Plan.find({}).lean(),
    ]);

    // MRR = sum over plans of (monthly price × active subscribers)
    const planCount = new Map(planAgg.map((p) => [p._id, p.count]));
    const priceMap = new Map(plans.map((p) => [p.key, p.period === 'year' ? p.price / 12 : p.price]));
    let mrr = 0;
    const revenueByPlan = plans.map((p) => {
        const subs = planCount.get(p.key) || 0;
        const monthly = (priceMap.get(p.key) || 0) * subs;
        mrr += monthly;
        return { plan: p.name, key: p.key, subscribers: subs, price: p.price, monthlyRevenue: Math.round(monthly) };
    });

    sendSuccess(res, {
        businesses,
        active,
        suspended: businesses - active,
        retail,
        wholesale,
        users,
        invoices,
        gmv: gmvAgg[0]?.total || 0,
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        revenueByPlan,
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

/** PATCH /admin/businesses/:id — toggle active / change plan / edit details */
export const updateBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const allowed: any = {};
    if (typeof req.body.isActive === 'boolean') allowed.isActive = req.body.isActive;
    ['plan', 'name', 'ownerName', 'gstin', 'city', 'state'].forEach((k) => {
        if (req.body[k] !== undefined) allowed[k] = req.body[k];
    });
    const business = await Business.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, business, 'Business updated');
});

/** POST /admin/businesses — create a business + its owner login */
export const createBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, type, ownerName, mobile, plan = 'free', gstin, city, state, password } = req.body;
    if (!name || !type || !ownerName || !mobile) throw AppError.badRequest('name, type, ownerName and mobile are required');
    if (!['retail', 'wholesale'].includes(type)) throw AppError.badRequest('type must be retail or wholesale');

    const normalized = normalizePhone(mobile);
    const exists = await User.findOne({ mobile: normalized });
    if (exists) throw AppError.conflict('A user with this mobile already exists');

    const cc = req.body.countryCode || '+91';
    const business = await Business.create({ name, type, ownerName, mobile: normalized, countryCode: cc, plan, gstin, city, state });
    const owner = await User.create({
        name: ownerName,
        mobile: normalized,
        countryCode: cc,
        role: 'owner',
        businessId: business._id,
        ...(password && { password }),
    });
    sendCreated(res, { business, owner: { _id: owner._id, name: owner.name, mobile: owner.mobile } }, 'Business created');
});

/** GET /admin/businesses/:id — detail with counts + users */
export const businessDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const business = await Business.findById(req.params.id).lean();
    if (!business) throw AppError.notFound('Business not found');
    const [users, products, invoiceAgg] = await Promise.all([
        User.find({ businessId: business._id }).select('name mobile role salary isActive').lean(),
        Product.countDocuments({ businessId: business._id }),
        Invoice.aggregate([{ $match: { businessId: business._id } }, { $group: { _id: null, count: { $sum: 1 }, gmv: { $sum: '$grandTotal' } } }]),
    ]);
    sendSuccess(res, {
        business,
        users,
        staffCount: users.filter((u) => STAFF_ROLES.includes(u.role as any)).length,
        products,
        invoices: invoiceAgg[0]?.count || 0,
        gmv: invoiceAgg[0]?.gmv || 0,
    });
});

/** DELETE /admin/businesses/:id — suspend (soft) the business + its users */
export const deleteBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const business = await Business.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!business) throw AppError.notFound('Business not found');
    await User.updateMany({ businessId: business._id }, { isActive: false });
    sendSuccess(res, { ok: true }, 'Business suspended');
});

/** PATCH /admin/users/:id — toggle active */
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const patch: any = {};
    if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
    if (req.body.name) patch.name = req.body.name;
    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true }).select('name mobile role isActive');
    if (!user) throw AppError.notFound('User not found');
    sendSuccess(res, user, 'User updated');
});

/* ---------------- Plans (subscriptions) ---------------- */

/** GET /admin/plans */
export const listPlans = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const plans = await Plan.find({}).sort({ order: 1, price: 1 }).lean();
    // attach subscriber counts per plan key (active businesses only)
    const counts = await Business.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$plan', count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    sendSuccess(res, plans.map((p) => ({ ...p, subscribers: countMap.get(p.key) || 0 })));
});

/** POST /admin/plans */
export const createPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { key, name, price, period = 'month', features = [], highlight = false, order = 0 } = req.body;
    if (!key || !name) throw AppError.badRequest('key and name are required');
    const plan = await Plan.create({ key: String(key).toLowerCase(), name, price: Number(price) || 0, period, features, highlight, order });
    sendCreated(res, plan);
});

/** PATCH /admin/plans/:id */
export const updatePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const patch: any = {};
    ['name', 'price', 'period', 'features', 'highlight', 'order', 'isActive'].forEach((k) => {
        if (req.body[k] !== undefined) patch[k] = k === 'price' || k === 'order' ? Number(req.body[k]) : req.body[k];
    });
    const plan = await Plan.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!plan) throw AppError.notFound('Plan not found');
    sendSuccess(res, plan, 'Plan updated');
});

/** DELETE /admin/plans/:id */
export const deletePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) throw AppError.notFound('Plan not found');
    const inUse = await Business.countDocuments({ plan: plan.key as any });
    if (inUse > 0) throw AppError.badRequest(`Cannot delete — ${inUse} business(es) are on this plan`);
    await plan.deleteOne();
    sendSuccess(res, { ok: true }, 'Plan deleted');
});
