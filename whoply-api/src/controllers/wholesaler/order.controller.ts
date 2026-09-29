import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Business from '../../models/Business.js';
import { applyStockChanges, takeStock } from '../../utils/stock.js';
import { priceDealerItems, recordAdvancePayment, orderRepId } from '../../utils/wholesaler.js';
import { netLineValue, round2 } from '../../utils/tax.js';
import { lineQty } from '../../utils/qty.js';
import CreditNote from '../../models/CreditNote.js';
import { nextSequence } from '../../models/Counter.js';
import { buildEInvoiceJson, buildEWayBillJson, orderToGstDoc } from '../../utils/gstJson.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';
import { istYm, gstMonth } from '../../utils/ist.js';
import { interStateExpr, splitTax } from '../../utils/gstSplit.js';

/**
 * POST /price-preview — what an order or quotation for this dealer would cost,
 * priced exactly as saving it would (the dealer's price group, each product's
 * GST). Saves nothing. body: { dealerId, items: [{ productId, quantity }] }
 */
export const previewDealerPrices = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items } = req.body;
    if (!Array.isArray(items) || !items.length) {
        sendSuccess(res, { lines: [], subtotal: 0, totalGst: 0, grandTotal: 0 });
        return;
    }
    const dealer = await Dealer.findOne({ _id: dealerId, businessId, isActive: true });
    if (!dealer) throw AppError.badRequest('Pick a dealer to see their prices');
    const { lineItems, subtotal, totalGst, grandTotal } = await priceDealerItems(businessId, dealer, items);
    sendSuccess(res, { tier: dealer.tier, lines: lineItems, subtotal, totalGst, grandTotal });
});

/**
 * POST /orders — create a wholesale bulk order.
 * body: { dealerId, items:[{productId, quantity}], source?, paidAmount?, paymentMode? }
 * Prices auto-resolve from the dealer's tier price-list. Stock is not taken here —
 * orders can be booked ahead of stock; it is checked and taken at dispatch.
 */
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items = [], source = 'manual' } = req.body;
    if (!dealerId) throw AppError.badRequest('dealerId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const dealer = await Dealer.findOne({ _id: dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst, grandTotal: total } = await priceDealerItems(businessId, dealer, items);

    const ym = istYm();
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
    const paidAmount = round2(Math.min(total, Math.max(0, Number(req.body.paidAmount) || 0)));
    const due = round2(total - paidAmount);

    const order = await Order.create({
        businessId,
        orderNo,
        dealerId,
        dealerName: dealer.name,
        dealerGstin: dealer.gstin,
        items: lineItems,
        subtotal,
        totalGst,
        total,
        paidAmount,
        dueAmount: due,
        status: 'pending',
        source,
        salesRepId: orderRepId(req.user, dealer),
    });
    await recordAdvancePayment(order, paidAmount, req.body.paymentMode ?? req.body.mode);

    // Dealer outstanding is derived from order dues (this new order's due included) — nothing to persist.
    sendCreated(res, order);
});

/**
 * Allowed status moves. Skipping ahead is fine (a counter pickup can go straight
 * from pending to delivered — stock is taken on the way); going backwards is
 * not, and a delivered order is closed — goods coming back are a return.
 */
const NEXT_STATUS: Record<string, string[]> = {
    pending: ['confirmed', 'dispatched', 'delivered', 'cancelled'],
    confirmed: ['dispatched', 'delivered', 'cancelled'],
    dispatched: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
};

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
 * PATCH /orders/:id — change what's on an order before it ships (pending or
 * confirmed; no stock has left yet). body: { items: [{ productId, quantity }] }
 * Priced like a new order — today's price list for the dealer's price group.
 * Money already received stays; the total can't drop below it.
 */
export const updateOrderItems = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');
    if (order.status !== 'pending' && order.status !== 'confirmed') {
        throw AppError.badRequest(
            order.status === 'cancelled'
                ? 'A cancelled order cannot be edited'
                : `This order is already ${order.status} — its goods have left, so record a return instead`
        );
    }
    const dealer = await Dealer.findOne({ _id: order.dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst, grandTotal: total } = await priceDealerItems(businessId, dealer, items);
    if (total < order.paidAmount - 0.005) {
        throw AppError.badRequest(`₹${order.paidAmount.toFixed(2)} is already paid on this order — the new total (₹${total.toFixed(2)}) can't be less`);
    }
    // Only while it's still in the status we read, so a dispatch at the same moment can't be edited under it.
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, businessId, status: order.status },
        { $set: { items: lineItems, subtotal, totalGst, total, dueAmount: round2(total - order.paidAmount), dealerGstin: dealer.gstin } },
        { new: true }
    );
    if (!updated) throw AppError.conflict('The order changed while you were editing it — open it again');
    sendSuccess(res, updated, 'Order updated');
});

/**
 * PATCH /orders/:id/status — move the order along its lifecycle (see NEXT_STATUS).
 * Leaving pending/confirmed for dispatched or delivered takes the stock — and
 * refuses if there isn't enough. Cancelling a dispatched order puts it back.
 */
export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { status, deliveryNote } = req.body;
    if (!(status in NEXT_STATUS) || status === 'pending') throw AppError.badRequest('Invalid status');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');
    if (status === order.status) {
        sendSuccess(res, order, `Order already ${status}`);
        return;
    }
    if (!NEXT_STATUS[order.status]?.includes(status)) {
        throw AppError.badRequest(
            order.status === 'delivered' && status === 'cancelled'
                ? 'A delivered order cannot be cancelled — record a return instead'
                : `Cannot move an order from ${order.status} to ${status}`
        );
    }

    const stockTaken = order.status === 'dispatched';
    if (!stockTaken && (status === 'dispatched' || status === 'delivered')) {
        await takeStock(
            businessId,
            order.items.map((li) => ({ productId: li.productId, quantity: li.quantity, name: li.name })),
            { reason: 'sale', refType: 'Order', refId: order._id }
        );
        order.dispatchedAt = new Date();
    }
    if (status === 'delivered') {
        order.deliveredAt = new Date();
        if (deliveryNote) order.deliveryNote = deliveryNote;
    }
    if (status === 'cancelled') {
        if (stockTaken) {
            await applyStockChanges(
                businessId,
                order.items.map((li) => ({ productId: li.productId, delta: li.quantity })),
                { reason: 'return', refType: 'Order', refId: order._id, note: `Cancelled ${order.orderNo}` }
            );
        }
        // A cancelled order owes nothing — clear its due so it drops out of dealer outstanding.
        // Anything already paid stays recorded as paid (a refund is settled outside the app).
        order.dueAmount = 0;
    }
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
 * GSTR-3B summary + rate-wise + HSN + B2B (by dealer GSTIN). IGST for dealers in another state,
 * CGST + SGST otherwise (utils/gstSplit.ts). Month by the Indian calendar.
 */
/** Line taxable value — stored `taxableValue` where present (GST-inclusive products), else price × qty. */
const ITEM_TAXABLE = { $ifNull: ['$items.taxableValue', { $multiply: ['$items.price', '$items.quantity'] }] };

export const wholesalerGstReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const { from, to, label } = gstMonth(req.query.month);
    const biz = await Business.findById(bId).select('gstin').lean();
    // Dealer in another state → IGST; same state (or no dealer GSTIN) → CGST + SGST.
    const INTER = interStateExpr(biz?.gstin, '$dealerGstin');
    const igstOf = (amount: any) => ({ $sum: { $cond: [INTER, amount, 0] } });
    const match = { businessId: bId, status: { $ne: 'cancelled' }, createdAt: { $gte: from, $lt: to } };

    const [summaryAgg, rateAgg, hsnAgg, b2bAgg] = await Promise.all([
        // $ifNull → legacy orders (created before GST fields existed) fall back to total as taxable, 0 GST.
        Order.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, taxable: { $sum: { $ifNull: ['$subtotal', '$total'] } }, gst: { $sum: { $ifNull: ['$totalGst', 0] } }, igst: igstOf({ $ifNull: ['$totalGst', 0] }), total: { $sum: '$total' } } }]),
        Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.gstRate', taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } }, { $sort: { _id: 1 } }]),
        Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: { hsn: { $ifNull: ['$items.hsn', '—'] }, rate: '$items.gstRate' }, name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } }, { $sort: { taxable: -1 } }]),
        Order.aggregate([{ $match: { ...match, dealerGstin: { $exists: true, $nin: [null, ''] } } }, { $group: { _id: '$dealerGstin', name: { $first: '$dealerName' }, count: { $sum: 1 }, taxable: { $sum: '$subtotal' }, gst: { $sum: '$totalGst' }, igst: igstOf('$totalGst'), total: { $sum: '$total' } } }, { $sort: { taxable: -1 } }]),
    ]);

    const s = summaryAgg[0] || { count: 0, taxable: 0, gst: 0, igst: 0, total: 0 };
    const b2b = b2bAgg.map((b) => ({ gstin: b._id, name: b.name, invoices: b.count, taxable: +b.taxable.toFixed(2), gst: +b.gst.toFixed(2), igst: +b.igst.toFixed(2), total: +b.total.toFixed(2) }));
    const b2bTaxable = b2b.reduce((a, x) => a + x.taxable, 0);
    const b2bGst = b2b.reduce((a, x) => a + x.gst, 0);

    sendSuccess(res, {
        month: label,
        summary: { invoices: s.count, taxableValue: +s.taxable.toFixed(2), ...splitTax(s.gst, s.igst), totalTax: +s.gst.toFixed(2), discount: 0, invoiceValue: +s.total.toFixed(2) },
        rateWise: rateAgg.map((r) => ({ rate: r._id || 0, taxable: +r.taxable.toFixed(2), ...splitTax(r.gst, r.igst), gst: +r.gst.toFixed(2) })),
        hsnWise: hsnAgg.map((h) => ({ hsn: h._id.hsn, name: h.name, rate: h._id.rate || 0, qty: h.qty, taxable: +h.taxable.toFixed(2), ...splitTax(h.gst, h.igst), gst: +h.gst.toFixed(2) })),
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
        const qty = lineQty(i.quantity, src);
        const maxReturnable = src.quantity - (alreadyReturned.get(String(i.productId)) || 0);
        if (qty > maxReturnable) throw AppError.badRequest(`Only ${maxReturnable} of "${src.name}" can be returned`);
        // Credit what was charged for these units (GST-inclusive lines included).
        const net = netLineValue(order, src);
        const base = round2((net.taxable * qty) / src.quantity);
        const gstAmount = round2((net.gst * qty) / src.quantity);
        subtotal += base; totalGst += gstAmount;
        return { productId: src.productId, name: src.name, hsn: src.hsn, unit: src.unit, quantity: qty, price: src.price, gstRate: src.gstRate || 0, gstAmount, taxableValue: base, lineTotal: round2(base + gstAmount) };
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

    const ym = istYm();
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
