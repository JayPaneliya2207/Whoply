import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf, todayRange, monthStart } from '../../utils/http.js';
import Invoice from '../../models/Invoice.js';
import Product from '../../models/Product.js';
import Customer from '../../models/Customer.js';
import Expense from '../../models/Expense.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

/** GET /dashboard — Shopkeeper dashboard tiles */
export const shopkeeperDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bId = new Types.ObjectId(String(businessId));
    const { start, end } = todayRange();

    const [todayAgg, monthAgg, lowStock, dueAgg, topProducts, recentInvoices, expenseAgg] = await Promise.all([
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: monthStart() } } },
            { $group: { _id: null, sales: { $sum: '$grandTotal' } } },
        ]),
        Product.countDocuments({ businessId: bId, isActive: true, $expr: { $lte: ['$currentStock', '$lowStockThreshold'] } }),
        Customer.aggregate([
            { $match: { businessId: bId, creditBalance: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$creditBalance' }, count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
            { $match: { businessId: bId, createdAt: { $gte: monthStart() } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
            { $sort: { qty: -1 } },
            { $limit: 5 },
        ]),
        Invoice.find({ businessId: bId }).sort({ createdAt: -1 }).limit(6).lean(),
        Expense.aggregate([
            { $match: { businessId: bId, spentAt: { $gte: monthStart() } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const monthSales = monthAgg[0]?.sales || 0;
    const monthExpense = expenseAgg[0]?.total || 0;

    sendSuccess(res, {
        todaySales: todayAgg[0]?.sales || 0,
        todayOrders: todayAgg[0]?.count || 0,
        monthSales,
        monthExpense,
        estimatedProfit: +(monthSales * 0.3 - monthExpense).toFixed(2), // ~30% gross margin est.
        lowStockCount: lowStock,
        pendingUdhar: dueAgg[0]?.total || 0,
        udharCustomers: dueAgg[0]?.count || 0,
        topProducts: topProducts.map((t) => ({ name: t._id, qty: t.qty, revenue: t.revenue })),
        recentInvoices,
    });
});
