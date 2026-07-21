import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import PriceList from '../../models/PriceList.js';
import StockMovement from '../../models/StockMovement.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** resolve tier price for a product, falling back to wholesalePrice/sellPrice */
const tierPrice = (priceRows: any[], productId: string, tier: string, p: any): number => {
    const row = priceRows.find((r) => String(r.productId) === String(productId) && r.tier === tier);
    return row ? row.price : p.wholesalePrice || p.sellPrice;
};

/**
 * POST /orders — create a wholesale bulk order.
 * body: { dealerId, items:[{productId, quantity}], source?, paidAmount? }
 * Prices auto-resolve from the dealer's tier price-list.
 */
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items = [], source = 'manual', paidAmount = 0 } = req.body;
    if (!dealerId) throw AppError.badRequest('dealerId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const dealer = await Dealer.findOne({ _id: dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const ids = items.map((i: any) => i.productId);
    const [products, priceRows] = await Promise.all([
        Product.find({ _id: { $in: ids }, businessId }),
        PriceList.find({ businessId, productId: { $in: ids }, tier: dealer.tier }).lean(),
    ]);
    const map = new Map(products.map((p) => [String(p._id), p]));

    let total = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Quantity must be positive');
        const price = tierPrice(priceRows, String(p._id), dealer.tier, p);
        const lineTotal = +(price * qty).toFixed(2);
        total += lineTotal;
        return { productId: p._id, name: p.name, quantity: qty, price, lineTotal };
    });

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
    const due = +(total - Number(paidAmount)).toFixed(2);

    const order = await Order.create({
        businessId,
        orderNo,
        dealerId,
        dealerName: dealer.name,
        items: lineItems,
        total: +total.toFixed(2),
        paidAmount: Number(paidAmount),
        dueAmount: due,
        status: 'pending',
        source,
        salesRepId: dealer.assignedRepId,
    });

    if (due > 0) {
        dealer.outstandingBalance += due;
        await dealer.save();
    }
    sendCreated(res, order);
});

export const listOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Order.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/**
 * PATCH /orders/:id/status — advance the order lifecycle.
 * confirmed → dispatched decrements stock; delivered stamps deliveredAt.
 */
export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { status, deliveryNote } = req.body;
    const valid = ['confirmed', 'dispatched', 'delivered', 'cancelled'];
    if (!valid.includes(status)) throw AppError.badRequest('Invalid status');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');

    if (status === 'dispatched' && order.status !== 'dispatched') {
        for (const li of order.items) {
            await Product.updateOne({ _id: li.productId }, { $inc: { currentStock: -li.quantity } });
            await StockMovement.create({
                businessId,
                productId: li.productId,
                reason: 'sale',
                quantity: -li.quantity,
                refType: 'Order',
                refId: order._id,
            });
        }
        order.dispatchedAt = new Date();
    }
    if (status === 'delivered') {
        order.deliveredAt = new Date();
        if (deliveryNote) order.deliveryNote = deliveryNote;
    }
    order.status = status;
    await order.save();
    sendSuccess(res, order, `Order marked ${status}`);
});
