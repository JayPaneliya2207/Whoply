import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf, todayRange } from '../../utils/http.js';
import Order from '../../models/Order.js';
import Dealer from '../../models/Dealer.js';
import Product from '../../models/Product.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

/** GET /dashboard — Wholesaler dashboard tiles */
export const wholesalerDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const { start, end } = todayRange();

    const [todayAgg, pendingDispatch, outstanding, warehouse, lowStock, dealerCount, revenueAgg, recentOrders, statusAgg] =
        await Promise.all([
            Order.aggregate([
                { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$total' } } },
            ]),
            Order.countDocuments({ businessId: bId, status: { $in: ['pending', 'confirmed'] } }),
            // Outstanding derived from live order dues (source of truth), grouped per dealer.
            Order.aggregate([
                { $match: { businessId: bId, dueAmount: { $gt: 0 } } },
                { $group: { _id: '$dealerId', due: { $sum: '$dueAmount' } } },
            ]),
            Product.aggregate([
                { $match: { businessId: bId } },
                { $group: { _id: null, units: { $sum: '$currentStock' }, skus: { $sum: 1 } } },
            ]),
            Product.countDocuments({ businessId: bId, isActive: true, isLowStock: true }),
            Dealer.countDocuments({ businessId: bId, isActive: true }),
            Order.aggregate([{ $match: { businessId: bId } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
            Order.find({ businessId: bId }).sort({ createdAt: -1 }).limit(6).lean(),
            Order.aggregate([{ $match: { businessId: bId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);

    sendSuccess(res, {
        todayOrders: todayAgg[0]?.count || 0,
        todaySales: todayAgg[0]?.sales || 0,
        pendingDispatch,
        outstandingPayments: outstanding.reduce((s, d) => s + (d.due || 0), 0),
        outstandingDealers: outstanding.length,
        warehouseUnits: warehouse[0]?.units || 0,
        skuCount: warehouse[0]?.skus || 0,
        lowStockCount: lowStock,
        dealerCount,
        revenue: revenueAgg[0]?.total || 0,
        recentOrders,
        statusBreakdown: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    });
});
