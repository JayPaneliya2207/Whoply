import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Quotation from '../../models/Quotation.js';
import { priceDealerItems, recordAdvancePayment, orderRepId } from '../../utils/wholesaler.js';
import { round2 } from '../../utils/tax.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { istYm } from '../../utils/ist.js';

/** POST /quotations — save a dealer quote (tier price; GST per product). */
export const createWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items = [], validDays } = req.body;
    if (!dealerId) throw AppError.badRequest('dealerId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');
    const dealer = await Dealer.findOne({ _id: dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst, grandTotal } = await priceDealerItems(businessId, dealer, items);

    const ym = istYm();
    const seq = await nextSequence(`quotation:${businessId}:${ym}`);
    const quoteNo = `QUO/${ym}/${String(seq).padStart(4, '0')}`;
    const validUntil = validDays ? new Date(Date.now() + Number(validDays) * 86400000) : undefined;

    const quote = await Quotation.create({
        businessId, quoteNo, dealerId, customerName: dealer.name, customerMobile: dealer.mobile, customerGstin: dealer.gstin,
        items: lineItems, subtotal, totalGst, discount: 0, grandTotal,
        validUntil, createdBy: req.user!._id,
    });
    sendCreated(res, quote, 'Quotation saved');
});

export const listWsQuotes = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, dealerId: { $exists: true, $ne: null } };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
        Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

export const deleteWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const q = await Quotation.findOneAndDelete({ _id: req.params.id, businessId });
    if (!q) throw AppError.notFound('Quotation not found');
    sendSuccess(res, { ok: true }, 'Quotation deleted');
});

/** POST /quotations/:id/convert — turn a dealer quote into a real Order (status pending). */
export const convertWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const quote = await Quotation.findOne({ _id: req.params.id, businessId, dealerId: { $exists: true } });
    if (!quote) throw AppError.notFound('Quotation not found');
    if (quote.status === 'converted') throw AppError.badRequest('This quotation is already converted');
    const dealer = await Dealer.findOne({ _id: quote.dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer no longer exists');

    const ym = istYm();
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
    const paidAmount = round2(Math.min(quote.grandTotal, Math.max(0, Number(req.body.paidAmount) || 0)));
    const due = round2(quote.grandTotal - paidAmount);

    const order = await Order.create({
        businessId, orderNo, dealerId: dealer._id, dealerName: dealer.name, dealerGstin: dealer.gstin,
        items: quote.items, subtotal: quote.subtotal, totalGst: quote.totalGst, total: quote.grandTotal,
        paidAmount, dueAmount: due, status: 'pending', source: 'manual', salesRepId: orderRepId(req.user, dealer),
    });
    await recordAdvancePayment(order, paidAmount, req.body.paymentMode ?? req.body.mode);
    quote.status = 'converted';
    quote.convertedInvoiceId = order._id;
    quote.convertedInvoiceNo = orderNo;
    await quote.save();
    sendCreated(res, order, 'Converted to order');
});
