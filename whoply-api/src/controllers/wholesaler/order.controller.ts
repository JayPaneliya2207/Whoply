import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Business from '../../models/Business.js';
import { applyStockChanges, takeStock } from '../../utils/stock.js';
import { priceDealerItems, quotedPricesFor, recordAdvancePayment, orderRepId, checkCreditLimit } from '../../utils/wholesaler.js';
import Payment from '../../models/Payment.js';
import { netLineValue, round2 } from '../../utils/tax.js';
import { lineQty } from '../../utils/qty.js';
import CreditNote from '../../models/CreditNote.js';
import { returnedSoFar, addReturned } from '../shopkeeper/return.controller.js';
import { nextSequence } from '../../models/Counter.js';
import { buildEInvoiceJson, buildEWayBillJson, orderToGstDoc } from '../../utils/gstJson.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types, type PipelineStage } from 'mongoose';
import { istYm, gstMonth } from '../../utils/ist.js';
import { interStateExpr, splitTax, netRows, rateKey, hsnKey, rateTable, hsnTable, setOffGst } from '../../utils/gstSplit.js';
import { purchaseCredit } from '../../utils/purchaseGst.js';

/**
 * POST /price-preview — what an order or quotation for this dealer would cost,
 * priced exactly as saving it would (the dealer's price group, each product's
 * GST). Saves nothing. body: { dealerId, items: [{ productId, quantity }], orderId? }
 * With `orderId` (editing that order) products from its estimate keep the quoted price.
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
    let from: Awaited<ReturnType<typeof quotedPricesFor>> | null = null;
    if (req.body.orderId && Types.ObjectId.isValid(String(req.body.orderId))) {
        const order = await Order.findOne({ _id: req.body.orderId, businessId, dealerId: dealer._id }).select('quotationId').lean();
        if (order) from = await quotedPricesFor(businessId, order);
    }
    const { lineItems, subtotal, totalGst, grandTotal } = await priceDealerItems(businessId, dealer, items, from?.prices);
    sendSuccess(res, { tier: dealer.tier, lines: lineItems, subtotal, totalGst, grandTotal, quoteNo: from?.quote?.quoteNo });
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

    const dealer = await Dealer.findOne({ _id: dealerId, businessId, isActive: true });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst, grandTotal: total } = await priceDealerItems(businessId, dealer, items);
    const paidAmount = round2(Math.min(total, Math.max(0, Number(req.body.paidAmount) || 0)));
    const due = round2(total - paidAmount);
    await checkCreditLimit(req.user, req.body, new Types.ObjectId(String(businessId)), dealer, due);

    const ym = istYm();
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;

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
    await recordAdvancePayment(order, paidAmount, req.body.paymentMode ?? req.body.mode, req.user?._id);

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
 * Priced like a new order — today's price list for the dealer's price group —
 * except products from the estimate the order was made from: those keep the
 * quoted price, whatever the quantity. Money already received stays; the total
 * can't drop below it.
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
    const dealer = await Dealer.findOne({ _id: order.dealerId, businessId, isActive: true });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const from = await quotedPricesFor(businessId, order);
    const { lineItems, subtotal, totalGst, grandTotal: total } = await priceDealerItems(businessId, dealer, items, from.prices);
    if (total < order.paidAmount - 0.005) {
        throw AppError.badRequest(`₹${order.paidAmount.toFixed(2)} is already paid on this order — the new total (₹${total.toFixed(2)}) can't be less`);
    }
    await checkCreditLimit(req.user, req.body, new Types.ObjectId(String(businessId)), dealer, round2(total - order.total));
    // Only while it's still in the status — and has the payments — we read, so a dispatch or a
    // collection at the same moment is never overwritten by a due worked out from old numbers.
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, businessId, status: order.status, paidAmount: order.paidAmount },
        { $set: { items: lineItems, subtotal, totalGst, total, dueAmount: round2(total - order.paidAmount), dealerGstin: dealer.gstin, ...(from.quote && { quotationId: from.quote._id, quoteNo: from.quote.quoteNo }) } },
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
            // Put back what is still out — returned units already came back with their credit note.
            const returned = await returnedQty(businessId, order._id);
            await applyStockChanges(
                businessId,
                order.items.map((li) => ({ productId: li.productId, delta: +(li.quantity - (returned.get(String(li.productId)) || 0)).toFixed(3) })),
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
 * Orders count at the value they were issued for. Dealer returns (credit notes) dated in the
 * month come off the summary, rate-wise and HSN tables and B2C, as in the shop report; B2B
 * stays gross, with its credit notes listed under `cdnr`. Cancelled orders and their returns
 * are left out.
 */
/** Line taxable value — stored `taxableValue` where present (GST-inclusive products), else price × qty. */
const ITEM_TAXABLE = { $ifNull: ['$items.taxableValue', { $multiply: ['$items.price', '$items.quantity'] }] };
/** A return lowers its order's saved totals — add every return on the order back for the value it was issued for. */
const ORDER_AS_ISSUED: PipelineStage[] = [
    { $lookup: { from: CreditNote.collection.name, localField: '_id', foreignField: 'orderId', pipeline: [{ $project: { subtotal: 1, totalGst: 1, total: 1 } }], as: 'cn' } },
    {
        $addFields: {
            // $ifNull → legacy orders (created before GST fields existed) fall back to total as taxable, 0 GST.
            subtotal: { $add: [{ $ifNull: ['$subtotal', '$total'] }, { $sum: '$cn.subtotal' }] },
            totalGst: { $add: [{ $ifNull: ['$totalGst', 0] }, { $sum: '$cn.totalGst' }] },
            total: { $add: ['$total', { $sum: '$cn.total' }] },
        },
    },
];
/** Keeps the credit notes whose order still counts (not cancelled). */
const ON_LIVE_ORDER: PipelineStage[] = [
    { $lookup: { from: Order.collection.name, localField: 'orderId', foreignField: '_id', pipeline: [{ $project: { status: 1 } }], as: 'order' } },
    { $match: { 'order.status': { $ne: 'cancelled' } } },
];

export const wholesalerGstReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bId = new Types.ObjectId(String(businessOf(req)));
    const { from, to, label } = gstMonth(req.query.month);
    const biz = await Business.findById(bId).select('gstin').lean();
    // Dealer in another state → IGST; same state (or no dealer GSTIN) → CGST + SGST.
    // Orders keep the dealer's GSTIN as dealerGstin, their credit notes as customerGstin.
    const igstBy = (buyerField: string) => (amount: string) => ({ $sum: { $cond: [interStateExpr(biz?.gstin, buyerField), amount, 0] } });
    const orderIgst = igstBy('$dealerGstin');
    const cnIgst = igstBy('$customerGstin');
    type IgstOf = typeof orderIgst;

    const inMonth = { businessId: bId, createdAt: { $gte: from, $lt: to } };
    const orders: PipelineStage[] = [{ $match: { ...inMonth, status: { $ne: 'cancelled' } } }];
    const returns: PipelineStage[] = [{ $match: { ...inMonth, orderId: { $exists: true, $ne: null } } }, ...ON_LIVE_ORDER];
    const totals = (igstOf: IgstOf): PipelineStage[] => [{ $group: { _id: null, count: { $sum: 1 }, taxable: { $sum: '$subtotal' }, gst: { $sum: '$totalGst' }, igst: igstOf('$totalGst'), total: { $sum: '$total' } } }];
    const byRate = (igstOf: IgstOf): PipelineStage[] => [{ $unwind: '$items' }, { $group: { _id: '$items.gstRate', taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } }];
    const byHsn = (igstOf: IgstOf): PipelineStage[] => [
        { $unwind: '$items' },
        { $group: { _id: { hsn: { $ifNull: ['$items.hsn', '—'] }, rate: '$items.gstRate' }, name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, taxable: { $sum: ITEM_TAXABLE }, gst: { $sum: '$items.gstAmount' }, igst: igstOf('$items.gstAmount') } },
    ];
    const byGstin = (gstinField: string, nameField: string, igstOf: IgstOf): PipelineStage[] => [
        { $match: { [gstinField]: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: `$${gstinField}`, name: { $first: `$${nameField}` }, count: { $sum: 1 }, taxable: { $sum: '$subtotal' }, gst: { $sum: '$totalGst' }, igst: igstOf('$totalGst'), total: { $sum: '$total' } } },
        { $sort: { taxable: -1 } },
    ];

    const [summaryAgg, rateAgg, hsnAgg, b2bAgg, cnSummaryAgg, cnRateAgg, cnHsnAgg, cdnrAgg] = await Promise.all([
        Order.aggregate([...orders, ...ORDER_AS_ISSUED, ...totals(orderIgst)]),
        Order.aggregate([...orders, ...byRate(orderIgst)]),
        Order.aggregate([...orders, ...byHsn(orderIgst)]),
        Order.aggregate([...orders, ...ORDER_AS_ISSUED, ...byGstin('dealerGstin', 'dealerName', orderIgst)]),
        CreditNote.aggregate([...returns, ...totals(cnIgst)]),
        CreditNote.aggregate([...returns, ...byRate(cnIgst)]),
        CreditNote.aggregate([...returns, ...byHsn(cnIgst)]),
        CreditNote.aggregate([...returns, ...byGstin('customerGstin', 'customerName', cnIgst)]),
    ]);

    const zero = { count: 0, taxable: 0, gst: 0, igst: 0, total: 0 };
    const s = summaryAgg[0] || zero;
    const cn = cnSummaryAgg[0] || zero;
    const b2b = b2bAgg.map((b) => ({ gstin: b._id, name: b.name, invoices: b.count, taxable: round2(b.taxable), gst: round2(b.gst), igst: round2(b.igst), total: round2(b.total) }));
    const cdnr = cdnrAgg.map((b) => ({ gstin: b._id, name: b.name, notes: b.count, taxable: round2(b.taxable), gst: round2(b.gst), igst: round2(b.igst), total: round2(b.total) }));
    const b2bTaxable = b2b.reduce((a, x) => a + x.taxable, 0);
    const b2bGst = b2b.reduce((a, x) => a + x.gst, 0);
    const cdnrTaxable = cdnr.reduce((a, x) => a + x.taxable, 0);
    const cdnrGst = cdnr.reduce((a, x) => a + x.gst, 0);
    const netGst = s.gst - cn.gst;
    const itc = await purchaseCredit(bId, from, to);

    sendSuccess(res, {
        month: label,
        summary: {
            invoices: s.count,
            taxableValue: round2(s.taxable - cn.taxable),
            ...splitTax(netGst, s.igst - cn.igst),
            totalTax: round2(netGst),
            discount: 0,
            invoiceValue: round2(s.total - cn.total),
            creditNotes: { count: cn.count, taxable: round2(cn.taxable), gst: round2(cn.gst), total: round2(cn.total) },
        },
        rateWise: rateTable(netRows(rateAgg, cnRateAgg, rateKey)),
        hsnWise: hsnTable(netRows(hsnAgg, cnHsnAgg, hsnKey)),
        b2b,
        cdnr,
        b2bTaxable: round2(b2bTaxable),
        b2bGst: round2(b2bGst),
        b2cTaxable: round2(s.taxable - b2bTaxable - (cn.taxable - cdnrTaxable)),
        b2cGst: round2(s.gst - b2bGst - (cn.gst - cdnrGst)),
        // Input tax credit from goods received this month, and the GST left to pay after it (estimate).
        itc,
        gstToPay: setOffGst(splitTax(netGst, s.igst - cn.igst), itc),
    });
});

/** Units of each product already returned on an order, across its credit notes. */
async function returnedQty(businessId: Types.ObjectId | string, orderId: Types.ObjectId): Promise<Map<string, number>> {
    const notes = await CreditNote.find({ businessId, orderId }).select('items.productId items.quantity').lean();
    const qty = new Map<string, number>();
    notes.forEach((n) => n.items.forEach((it) => qty.set(String(it.productId), (qty.get(String(it.productId)) || 0) + it.quantity)));
    return qty;
}

/**
 * POST /orders/:id/return — record a dealer return (credit note against an order).
 * body: { items:[{ productId, quantity }], reason? }
 * Only once the goods have left (dispatched/delivered) — before that the order is
 * edited or cancelled instead. Restores stock, reduces the order's value & the
 * dealer's outstanding; any overpaid amount becomes a cash refund owed.
 */
export const createOrderReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], reason } = req.body;
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('Select at least one item to return');

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) throw AppError.notFound('Order not found');
    if (order.status !== 'dispatched' && order.status !== 'delivered') {
        throw AppError.badRequest(
            order.status === 'cancelled'
                ? 'A cancelled order cannot have a return'
                : 'This order has not shipped yet — edit or cancel it instead of recording a return'
        );
    }

    const rev = order.returnsRev || 0;
    const alreadyReturned = await returnedSoFar(order.returned, () => CreditNote.find({ businessId, orderId: order._id }).select('items.productId items.quantity').lean());

    // The same product listed twice counts as one request for the total.
    const wanted = new Map<string, number>();
    for (const i of items) {
        const src = order.items.find((it) => String(it.productId) === String(i?.productId));
        if (!src) throw AppError.badRequest('Item not part of this order');
        wanted.set(String(src.productId), Math.round(((wanted.get(String(src.productId)) || 0) + lineQty(i.quantity, src)) * 1000) / 1000);
    }

    let subtotal = 0, totalGst = 0;
    const lineItems = [...wanted].map(([productId, qty]) => {
        const src = order.items.find((it) => String(it.productId) === productId)!;
        const maxReturnable = src.quantity - (alreadyReturned.get(productId) || 0);
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
    // Saved only if the order still has the total and payments we read: two returns (or a
    // return and a collection) at the same moment can't both use the same numbers.
    const before = { total: order.total, paidAmount: order.paidAmount };
    order.subtotal = +Math.max(0, (order.subtotal ?? order.total) - subtotal).toFixed(2);
    order.totalGst = +Math.max(0, (order.totalGst ?? 0) - totalGst).toFixed(2);
    order.total = +Math.max(0, order.total - total).toFixed(2);
    let cashRefund = 0;
    if (order.paidAmount > order.total) { cashRefund = +(order.paidAmount - order.total).toFixed(2); order.paidAmount = order.total; }
    order.dueAmount = +Math.max(0, order.total - order.paidAmount).toFixed(2);
    const saved = await Order.updateOne(
        { _id: order._id, businessId, status: order.status, total: before.total, paidAmount: before.paidAmount, returnsRev: rev === 0 ? { $in: [0, null] } : rev },
        { $set: { subtotal: order.subtotal, totalGst: order.totalGst, total: order.total, paidAmount: order.paidAmount, dueAmount: order.dueAmount, returnsRev: rev + 1, returned: addReturned(alreadyReturned, wanted) } }
    );
    if (saved.modifiedCount !== 1) throw AppError.conflict('The order changed while you were recording the return — open it again');

    // The goods left on dispatch, so they come back into stock.
    await applyStockChanges(
        businessId,
        lineItems.map((li) => ({ productId: li.productId, delta: li.quantity })),
        { reason: 'return', refType: 'CreditNote', refId: order._id }
    );

    const ym = istYm();
    const seq = await nextSequence(`creditnote:${businessId}:${ym}`);
    const creditNoteNo = `CN/${ym}/${String(seq).padStart(4, '0')}`;
    const note = await CreditNote.create({
        businessId, creditNoteNo, orderId: order._id, orderNo: order.orderNo, dealerId: order.dealerId,
        customerName: order.dealerName, customerGstin: order.dealerGstin,
        items: lineItems, subtotal: +subtotal.toFixed(2), totalGst: +totalGst.toFixed(2), total, reason,
        refundMode: cashRefund > 0 ? 'cash' : 'udhar_adjust', cashRefund, createdBy: req.user!._id,
    });
    // Money going back to the dealer is a negative row in the payments book, so the
    // Payments page and the tally agree with what the orders show as paid.
    if (cashRefund > 0) {
        await Payment.create({
            businessId: order.businessId, dealerId: order.dealerId, dealerName: order.dealerName, orderId: order._id, orderNo: order.orderNo,
            amount: -cashRefund, mode: 'cash', note: `Refund on return ${creditNoteNo}`, collectedBy: req.user?._id,
        });
    }
    sendCreated(res, { creditNote: note, cashRefund, stockRestored: true }, 'Return recorded');
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
