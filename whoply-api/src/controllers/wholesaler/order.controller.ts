import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import PriceList from '../../models/PriceList.js';
import Business from '../../models/Business.js';
import { applyStockChanges } from '../../utils/stock.js';
import CreditNote from '../../models/CreditNote.js';
import { nextSequence } from '../../models/Counter.js';
import { buildEInvoiceJson, buildEWayBillJson, orderToGstDoc } from '../../utils/gstJson.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

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

    let subtotal = 0;
    let totalGst = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Quantity must be positive');
        const price = tierPrice(priceRows, String(p._id), dealer.tier, p);
        const base = price * qty;
        const gstAmount = +((base * (p.gstRate || 0)) / 100).toFixed(2); // GST added on top (exclusive)
        subtotal += base;
        totalGst += gstAmount;
        return { productId: p._id, name: p.name, hsn: p.hsn, unit: p.unit, quantity: qty, price, gstRate: p.gstRate || 0, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) };
    });
    const total = +(subtotal + totalGst).toFixed(2);

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
    const due = +(total - Number(paidAmount)).toFixed(2);

    const order = await Order.create({
        businessId,
        orderNo,
        dealerId,
        dealerName: dealer.name,
        dealerGstin: dealer.gstin,
        items: lineItems,
        subtotal: +subtotal.toFixed(2),
        totalGst: +totalGst.toFixed(2),
        total,
        paidAmount: Number(paidAmount),
        dueAmount: due,
        status: 'pending',
        source,
        salesRepId: dealer.assignedRepId,
    });

    // Dealer outstanding is derived from order dues (this new order's due included) — nothing to persist.
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
        await applyStockChanges(
            businessId,
            order.items.map((li) => ({ productId: li.productId, delta: -li.quantity })),
            { reason: 'sale', refType: 'Order', refId: order._id }
        );
        order.dispatchedAt = new Date();
    }
    if (status === 'delivered') {
        order.deliveredAt = new Date();
        if (deliveryNote) order.deliveryNote = deliveryNote;
    }
    // A cancelled order owes nothing — clear its due so it drops out of dealer outstanding.
    if (status === 'cancelled') order.dueAmount = 0;
    order.status = status;
    await order.save();
    sendSuccess(res, order, `Order marked ${status}`);
});

/** GET /orders/:id/einvoice — e-invoice (IRP) JSON for a wholesale order. */
export const orderEInvoiceJson = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [order, biz] = await Promise.all([Order.findOne({ _id: req.params.id, businessId }), Business.findById(businessId)]);
    if (!order) throw AppError.notFound('Order not found');
    if (!biz?.gstin) throw AppError.badRequest('Set your GSTIN in Settings → Business profile before generating an e-invoice');
    sendSuccess(res, buildEInvoiceJson(biz, orderToGstDoc(order)));
});

/** POST /orders/:id/eway — e-way bill JSON for a wholesale order. */
export const orderEWayJson = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [order, biz] = await Promise.all([Order.findOne({ _id: req.params.id, businessId }), Business.findById(businessId)]);
    if (!order) throw AppError.notFound('Order not found');
    if (!biz?.gstin) throw AppError.badRequest('Set your GSTIN in Settings → Business profile before generating an e-way bill');
    sendSuccess(res, buildEWayBillJson(biz, orderToGstDoc(order), {
        vehicleNo: req.body.vehicleNo, distance: Number(req.body.distance) || 0, transMode: req.body.transMode,
        transporterName: req.body.transporterName, transporterId: req.body.transporterId,
    }));
});

/**
 * GET /reports/gst?month=YYYY-MM — wholesale GST returns from orders (GST added on top).
 * GSTR-3B summary + rate-wise + HSN + B2B (by dealer GSTIN). CGST/SGST split 50/50 intra-state.
 */
export const wholesalerGstReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const now = new Date();
    let from: Date, to: Date;
    if (req.query.month && /^\d{4}-\d{2}$/.test(String(req.query.month))) {
        const [y, m] = String(req.query.month).split('-').map(Number);
        from = new Date(y, m - 1, 1); to = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
        from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const match = { businessId: bId, status: { $ne: 'cancelled' }, createdAt: { $gte: from, $lte: to } };

    const [summaryAgg, rateAgg, hsnAgg, b2bAgg] = await Promise.all([
        // $ifNull → legacy orders (created before GST fields existed) fall back to total as taxable, 0 GST.
        Order.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, taxable: { $sum: { $ifNull: ['$subtotal', '$total'] } }, gst: { $sum: { $ifNull: ['$totalGst', 0] } }, total: { $sum: '$total' } } }]),
        Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.gstRate', taxable: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, gst: { $sum: '$items.gstAmount' } } }, { $sort: { _id: 1 } }]),
        Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: { hsn: { $ifNull: ['$items.hsn', '—'] }, rate: '$items.gstRate' }, name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, taxable: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, gst: { $sum: '$items.gstAmount' } } }, { $sort: { taxable: -1 } }]),
        Order.aggregate([{ $match: { ...match, dealerGstin: { $exists: true, $nin: [null, ''] } } }, { $group: { _id: '$dealerGstin', name: { $first: '$dealerName' }, count: { $sum: 1 }, taxable: { $sum: '$subtotal' }, gst: { $sum: '$totalGst' }, total: { $sum: '$total' } } }, { $sort: { taxable: -1 } }]),
    ]);

    const s = summaryAgg[0] || { count: 0, taxable: 0, gst: 0, total: 0 };
    const half = (n: number) => +(n / 2).toFixed(2);
    const b2b = b2bAgg.map((b) => ({ gstin: b._id, name: b.name, invoices: b.count, taxable: +b.taxable.toFixed(2), gst: +b.gst.toFixed(2), total: +b.total.toFixed(2) }));
    const b2bTaxable = b2b.reduce((a, x) => a + x.taxable, 0);
    const b2bGst = b2b.reduce((a, x) => a + x.gst, 0);

    sendSuccess(res, {
        month: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
        summary: { invoices: s.count, taxableValue: +s.taxable.toFixed(2), cgst: half(s.gst), sgst: half(s.gst), igst: 0, totalTax: +s.gst.toFixed(2), discount: 0, invoiceValue: +s.total.toFixed(2) },
        rateWise: rateAgg.map((r) => ({ rate: r._id || 0, taxable: +r.taxable.toFixed(2), cgst: half(r.gst), sgst: half(r.gst), gst: +r.gst.toFixed(2) })),
        hsnWise: hsnAgg.map((h) => ({ hsn: h._id.hsn, name: h.name, rate: h._id.rate || 0, qty: h.qty, taxable: +h.taxable.toFixed(2), gst: +h.gst.toFixed(2) })),
        b2b, b2bTaxable: +b2bTaxable.toFixed(2), b2bGst: +b2bGst.toFixed(2),
        b2cTaxable: +(s.taxable - b2bTaxable).toFixed(2), b2cGst: +(s.gst - b2bGst).toFixed(2),
    });
});

/**
 * POST /orders/:id/return — record a dealer return (credit note against an order).
 * body: { items:[{ productId, quantity }], reason? }
 * Restores stock (only if the order was dispatched/delivered), reduces the order's
 * value & the dealer's outstanding; any overpaid amount becomes a cash refund owed.
 */
export const createOrderReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], reason } = req.body;
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('Select at least one item to return');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');

    const priorNotes = await CreditNote.find({ businessId, orderId: order._id }).lean();
    const alreadyReturned = new Map<string, number>();
    priorNotes.forEach((n) => n.items.forEach((it) => alreadyReturned.set(String(it.productId), (alreadyReturned.get(String(it.productId)) || 0) + it.quantity)));

    let subtotal = 0, totalGst = 0;
    const lineItems = items.map((i: any) => {
        const src = order.items.find((it) => String(it.productId) === String(i.productId));
        if (!src) throw AppError.badRequest('Item not part of this order');
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Return quantity must be positive');
        const maxReturnable = src.quantity - (alreadyReturned.get(String(i.productId)) || 0);
        if (qty > maxReturnable) throw AppError.badRequest(`Only ${maxReturnable} of "${src.name}" can be returned`);
        const base = +(src.price * qty).toFixed(2);
        const gstAmount = +((base * (src.gstRate || 0)) / 100).toFixed(2);
        subtotal += base; totalGst += gstAmount;
        return { productId: src.productId, name: src.name, hsn: src.hsn, unit: src.unit, quantity: qty, price: src.price, gstRate: src.gstRate || 0, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) };
    });
    const total = +(subtotal + totalGst).toFixed(2);

    // Reduce the order (net of return), keeping total = paid + due; overpay → cash refund owed.
    order.subtotal = +Math.max(0, (order.subtotal ?? order.total) - subtotal).toFixed(2);
    order.totalGst = +Math.max(0, (order.totalGst ?? 0) - totalGst).toFixed(2);
    order.total = +Math.max(0, order.total - total).toFixed(2);
    let cashRefund = 0;
    if (order.paidAmount > order.total) { cashRefund = +(order.paidAmount - order.total).toFixed(2); order.paidAmount = order.total; }
    order.dueAmount = +Math.max(0, order.total - order.paidAmount).toFixed(2);
    await order.save();

    // Restore stock only if it was actually decremented (dispatch happened).
    const stockWasReduced = order.status === 'dispatched' || order.status === 'delivered';
    if (stockWasReduced) {
        await applyStockChanges(
            businessId,
            lineItems.map((li) => ({ productId: li.productId, delta: li.quantity })),
            { reason: 'return', refType: 'CreditNote', refId: order._id }
        );
    }

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`creditnote:${businessId}:${ym}`);
    const creditNoteNo = `CN/${ym}/${String(seq).padStart(4, '0')}`;
    const note = await CreditNote.create({
        businessId, creditNoteNo, orderId: order._id, orderNo: order.orderNo, dealerId: order.dealerId,
        customerName: order.dealerName, customerGstin: order.dealerGstin,
        items: lineItems, subtotal: +subtotal.toFixed(2), totalGst: +totalGst.toFixed(2), total, reason,
        refundMode: cashRefund > 0 ? 'cash' : 'udhar_adjust', cashRefund, createdBy: req.user!._id,
    });
    sendCreated(res, { creditNote: note, cashRefund, stockRestored: stockWasReduced }, 'Return recorded');
});

/** GET /returns — wholesale credit notes (against orders). */
export const listOrderReturns = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, orderId: { $exists: true, $ne: null } };
    const [items, total] = await Promise.all([
        CreditNote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CreditNote.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});
