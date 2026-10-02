import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import Invoice from '../../models/Invoice.js';
import Order from '../../models/Order.js';
import Plan from '../../models/Plan.js';
import SubscriptionBill from '../../models/SubscriptionBill.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { IST_TZ, istParts, istMidnight, istDayRange } from '../../utils/ist.js';

/** Money sold: retail bills (Invoice.grandTotal) and wholesale orders that weren't cancelled (Order.total). */
const LIVE_ORDERS = { status: { $ne: 'cancelled' as const } };
const r0 = (n: number) => Math.round(n || 0);

/** Count (and sum of `amount`, if given) per India-time month "2026-10", for documents created since `since`. */
const byMonth = (Model: any, match: object, amount: string, since: Date) =>
    Model.aggregate([
        { $match: { ...match, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: IST_TZ } }, total: amount ? { $sum: `$${amount}` } : { $sum: 0 }, count: { $sum: 1 } } },
    ]);

const byBusiness = (Model: any, match: object, amount: string, since: Date) =>
    Model.aggregate([
        { $match: { ...match, createdAt: { $gte: since } } },
        { $group: { _id: '$businessId', total: { $sum: `$${amount}` }, count: { $sum: 1 } } },
    ]);

/**
 * GET /admin/stats — platform-wide KPIs: counts, lifetime GMV, subscription
 * revenue (MRR from the plans), the last 6 India-time months of sales and
 * sign-ups, this month's top businesses, the newest sign-ups, and subscription
 * money: collected this month and still to collect.
 */
export const platformStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const { y, m } = istParts(new Date());
    const monthStart = istMidnight(y, m, 1);
    const sixStart = istMidnight(y, m - 5, 1);
    // Oldest first, ending with the current month.
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(Date.UTC(y, m - 6 + i, 1));
        return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) };
    });

    const [businesses, retail, wholesale, active, users, invoices, orders, gmvAgg, orderGmvAgg, planAgg, plans,
        invMonthly, ordMonthly, bizMonthly, userMonthly, topInv, topOrd, recentBusinesses, billsDue, billsPaid] = await Promise.all([
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
        byMonth(Invoice, {}, 'grandTotal', sixStart),
        byMonth(Order, LIVE_ORDERS, 'total', sixStart),
        byMonth(Business, {}, '', sixStart),
        byMonth(User, { role: { $ne: 'admin' } }, '', sixStart),
        byBusiness(Invoice, {}, 'grandTotal', monthStart),
        byBusiness(Order, LIVE_ORDERS, 'total', monthStart),
        Business.find({}).sort({ createdAt: -1 }).limit(5).select('name type plan city ownerName isActive createdAt').lean(),
        SubscriptionBill.aggregate([
            { $match: { status: 'due' } },
            { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, overdue: { $sum: { $cond: [{ $lt: ['$dueDate', istDayRange().start] }, 1, 0] } } } },
        ]),
        SubscriptionBill.aggregate([{ $match: { status: 'paid', paidAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    ]);

    // MRR = sum over plans of (monthly price × active subscribers)
    const planCount = new Map(planAgg.map((p) => [p._id, p.count]));
    const priceMap = new Map(plans.map((p) => [p.key, p.period === 'year' ? p.price / 12 : p.price]));
    let mrr = 0;
    const revenueByPlan = plans.map((p) => {
        const subs = planCount.get(p.key) || 0;
        const monthly = (priceMap.get(p.key) || 0) * subs;
        mrr += monthly;
        return { plan: p.name, key: p.key, subscribers: subs, price: p.price, period: p.period, monthlyRevenue: Math.round(monthly) };
    });

    // Six months of sales and sign-ups, with zeros for quiet months.
    const at = (rows: any[], key: string) => rows.find((r) => r._id === key);
    const monthly = months.map(({ key, label }) => {
        const inv = at(invMonthly, key);
        const ord = at(ordMonthly, key);
        const retailGmv = r0(inv?.total);
        const wholesaleGmv = r0(ord?.total);
        return { month: key, label, retailGmv, wholesaleGmv, gmv: retailGmv + wholesaleGmv, bills: inv?.count || 0, orders: ord?.count || 0, newBusinesses: at(bizMonthly, key)?.count || 0, newUsers: at(userMonthly, key)?.count || 0 };
    });
    const thisMonth = monthly[5];
    const lastMonth = monthly[4];
    const growthPct = lastMonth.gmv > 0 ? Math.round(((thisMonth.gmv - lastMonth.gmv) / lastMonth.gmv) * 100) : null;

    // This month's top businesses by what they sold (bills + orders).
    const totals = new Map<string, { gmv: number; count: number }>();
    for (const row of [...topInv, ...topOrd]) {
        const k = String(row._id);
        const t = totals.get(k) || { gmv: 0, count: 0 };
        t.gmv += row.total;
        t.count += row.count;
        totals.set(k, t);
    }
    const topIds = [...totals].sort((a, b) => b[1].gmv - a[1].gmv).slice(0, 5);
    const topDocs = topIds.length ? await Business.find({ _id: { $in: topIds.map(([id]) => id) } }).select('name type city plan').lean() : [];
    const topBusinesses = topIds.map(([id, t]) => {
        const b = topDocs.find((x) => String(x._id) === id);
        return { _id: id, name: b?.name || '—', type: b?.type, city: b?.city, plan: b?.plan, gmv: r0(t.gmv), count: t.count };
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
        monthly,
        thisMonth: { ...thisMonth, growthPct },
        lastMonthGmv: lastMonth.gmv,
        topBusinesses,
        recentBusinesses,
        // Real subscription money (bills), next to the expected figure above (mrr).
        billing: {
            collectedThisMonth: Math.round(billsPaid[0]?.total || 0), paidCount: billsPaid[0]?.count || 0,
            dueTotal: Math.round(billsDue[0]?.total || 0), dueCount: billsDue[0]?.count || 0, overdueCount: billsDue[0]?.overdue || 0,
        },
    });
});
