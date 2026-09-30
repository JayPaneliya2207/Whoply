import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import Invoice from '../../models/Invoice.js';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import Plan from '../../models/Plan.js';
import { STAFF_ROLES, type AuthRequest } from '../../interfaces/index.js';
import { containsText } from '../../utils/search.js';
import { passwordSchema } from '../../validators/common.validator.js';

/** Money sold: retail bills (Invoice.grandTotal) and wholesale orders that weren't cancelled (Order.total). */
const LIVE_ORDERS = { status: { $ne: 'cancelled' as const } };

/** The plan must be one the admin has set up (Plans page). */
async function assertPlan(key: unknown): Promise<string> {
    const plan = String(key || '').trim().toLowerCase();
    if (!plan || !(await Plan.exists({ key: plan }))) throw AppError.badRequest(`No plan "${plan}" — add it on the Plans page first`);
    return plan;
}

/** GET /admin/stats — platform-wide KPIs + account tally (MRR from subscriptions) */
export const platformStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [businesses, retail, wholesale, active, users, invoices, orders, gmvAgg, orderGmvAgg, planAgg, plans] = await Promise.all([
        Business.countDocuments({}),
        Business.countDocuments({ type: 'retail' }),
        Business.countDocuments({ type: 'wholesale' }),
        Business.countDocuments({ isActive: true }),
        User.countDocuments({ role: { $ne: 'admin' }, isActive: true }),
        Invoice.countDocuments({}),
        Order.countDocuments(LIVE_ORDERS),
        Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
        Order.aggregate([{ $match: LIVE_ORDERS }, { $group: { _id: null, total: { $sum: '$total' } } }]),
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

    const retailGmv = gmvAgg[0]?.total || 0;
    const wholesaleGmv = orderGmvAgg[0]?.total || 0;
    sendSuccess(res, {
        businesses,
        active,
        suspended: businesses - active,
        retail,
        wholesale,
        users,
        invoices,
        orders,
        gmv: retailGmv + wholesaleGmv,
        retailGmv,
        wholesaleGmv,
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
    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.search) filter.name = containsText(req.query.search);

    const [items, total] = await Promise.all([
        Business.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Business.countDocuments(filter),
    ]);

    // enrich with counts — bills for a shop, orders for a wholesaler
    const enriched = await Promise.all(
        items.map(async (b) => {
            const [productCount, invoiceCount, orderCount] = await Promise.all([
                Product.countDocuments({ businessId: b._id, isActive: true }),
                Invoice.countDocuments({ businessId: b._id }),
                Order.countDocuments({ businessId: b._id, ...LIVE_ORDERS }),
            ]);
            return { ...b, productCount, invoiceCount, orderCount };
        })
    );
    sendPaginated(res, enriched, meta(total));
});

/**
 * GET /admin/users?search=&page=&limit= — people across tenants. Only what the
 * list shows: never KYC documents, ID numbers, salary or login secrets.
 */
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (req.query.search) {
        const digits = String(req.query.search).replace(/\D/g, '');
        filter.$or = [{ name: containsText(req.query.search) }, ...(digits.length >= 3 ? [{ mobile: containsText(digits) }] : [])];
    }
    const [items, total] = await Promise.all([
        User.find(filter)
            .select('name mobile countryCode role businessId isActive lastLogin createdAt')
            .populate('businessId', 'name type')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        User.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/** PATCH /admin/businesses/:id — suspend / resume, change plan, edit details */
export const updateBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const allowed: any = {};
    if (typeof req.body.isActive === 'boolean') allowed.isActive = req.body.isActive;
    ['name', 'ownerName', 'gstin', 'city', 'state'].forEach((k) => {
        if (req.body[k] !== undefined) allowed[k] = typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k];
    });
    if (allowed.name !== undefined && !allowed.name) throw AppError.badRequest('Business name is required');
    if (req.body.plan !== undefined) allowed.plan = await assertPlan(req.body.plan);
    const business = await Business.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true });
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, business, business.isActive ? 'Business updated' : 'Business suspended — its logins are blocked');
});

/** POST /admin/businesses — create a business + its owner login */
export const createBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, type, ownerName, mobile, plan = 'free', gstin, city, state, password } = req.body;
    if (!name || !type || !ownerName || !mobile) throw AppError.badRequest('name, type, ownerName and mobile are required');
    if (!['retail', 'wholesale'].includes(type)) throw AppError.badRequest('type must be retail or wholesale');
    if (password) passwordSchema.parse(String(password));
    const planKey = await assertPlan(plan);

    const normalized = normalizePhone(mobile);
    const exists = await User.findOne({ mobile: normalized });
    if (exists) throw AppError.conflict('A user with this mobile already exists');

    const cc = req.body.countryCode || '+91';
    const business = await Business.create({ name, type, ownerName, mobile: normalized, countryCode: cc, plan: planKey, gstin, city, state });
    let owner;
    try {
        owner = await User.create({
            name: ownerName,
            mobile: normalized,
            countryCode: cc,
            role: 'owner',
            businessId: business._id,
            ...(password && { password }),
        });
    } catch (e) {
        await Business.deleteOne({ _id: business._id }); // no business left without an owner
        throw e;
    }
    sendCreated(res, { business, owner: { _id: owner._id, name: owner.name, mobile: owner.mobile } }, 'Business created');
});

/** GET /admin/businesses/:id — detail with counts + users */
export const businessDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const business = await Business.findById(req.params.id).lean();
    if (!business) throw AppError.notFound('Business not found');
    const [users, products, invoiceAgg, orderAgg] = await Promise.all([
        User.find({ businessId: business._id }).select('name mobile role isActive').lean(),
        Product.countDocuments({ businessId: business._id, isActive: true }),
        Invoice.aggregate([{ $match: { businessId: business._id } }, { $group: { _id: null, count: { $sum: 1 }, gmv: { $sum: '$grandTotal' } } }]),
        Order.aggregate([{ $match: { businessId: business._id, ...LIVE_ORDERS } }, { $group: { _id: null, count: { $sum: 1 }, gmv: { $sum: '$total' } } }]),
    ]);
    sendSuccess(res, {
        business,
        users,
        staffCount: users.filter((u) => u.isActive && STAFF_ROLES.includes(u.role as any)).length,
        products,
        invoices: invoiceAgg[0]?.count || 0,
        orders: orderAgg[0]?.count || 0,
        gmv: (invoiceAgg[0]?.gmv || 0) + (orderAgg[0]?.gmv || 0),
    });
});

/**
 * DELETE /admin/businesses/:id — suspend the business. Its logins are blocked
 * while it is suspended (auth middleware + login); users are left as they are,
 * so resuming it brings everyone back — and staff the owner removed stay removed.
 */
export const deleteBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const business = await Business.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, { ok: true }, 'Business suspended');
});

/** PATCH /admin/users/:id — turn a login on/off, rename. Never an admin (yourself included) — that could lock everyone out. */
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const patch: any = {};
    if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
    if (typeof req.body.name === 'string' && req.body.name.trim()) patch.name = req.body.name.trim();
    const target = await User.findById(req.params.id).select('role').lean();
    if (!target) throw AppError.notFound('User not found');
    if (target.role === 'admin' && patch.isActive === false) throw AppError.badRequest('An admin login can not be turned off here');
    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true }).select('name mobile role isActive');
    if (!user) throw AppError.notFound('User not found');
    sendSuccess(res, user, 'User updated');
});

/* ---------------- Plans (subscriptions) ---------------- */

/** Price 0 or more, period month or year. */
function planFields(body: any, creating: boolean) {
    const patch: any = {};
    if (body.name !== undefined || creating) {
        patch.name = String(body.name || '').trim();
        if (!patch.name) throw AppError.badRequest('Plan name is required');
    }
    if (body.price !== undefined || creating) {
        patch.price = Number(body.price ?? 0);
        if (!(patch.price >= 0)) throw AppError.badRequest('Price must be 0 or more');
    }
    if (body.period !== undefined || creating) {
        patch.period = body.period ?? 'month';
        if (!['month', 'year'].includes(patch.period)) throw AppError.badRequest('Period must be month or year');
    }
    if (body.features !== undefined) {
        if (!Array.isArray(body.features)) throw AppError.badRequest('Features must be a list');
        patch.features = body.features.map((f: unknown) => String(f).trim()).filter(Boolean);
    }
    if (body.highlight !== undefined) patch.highlight = !!body.highlight;
    if (body.order !== undefined) patch.order = Number(body.order) || 0;
    if (!creating && typeof body.isActive === 'boolean') patch.isActive = body.isActive;
    return patch;
}

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
    const key = String(req.body.key || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,29}$/.test(key)) throw AppError.badRequest('Plan key: letters, numbers, - or _ (e.g. "pro")');
    const plan = await Plan.create({ key, features: [], highlight: false, order: 0, ...planFields(req.body, true) });
    sendCreated(res, plan);
});

/** PATCH /admin/plans/:id */
export const updatePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const plan = await Plan.findByIdAndUpdate(req.params.id, planFields(req.body, false), { new: true, runValidators: true });
    if (!plan) throw AppError.notFound('Plan not found');
    sendSuccess(res, plan, 'Plan updated');
});

/** DELETE /admin/plans/:id */
export const deletePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) throw AppError.notFound('Plan not found');
    const inUse = await Business.countDocuments({ plan: plan.key });
    if (inUse > 0) throw AppError.badRequest(`Cannot delete — ${inUse} business(es) are on this plan`);
    await plan.deleteOne();
    sendSuccess(res, { ok: true }, 'Plan deleted');
});
