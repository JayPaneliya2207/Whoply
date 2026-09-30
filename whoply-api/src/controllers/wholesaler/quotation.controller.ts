import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Quotation from '../../models/Quotation.js';
import { priceDealerItems, recordAdvancePayment, orderRepId, checkCreditLimit } from '../../utils/wholesaler.js';
import { Types } from 'mongoose';
import { round2 } from '../../utils/tax.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { istYm } from '../../utils/ist.js';
import { validUntilFrom, assertNotExpired } from '../../utils/quote.js';
import User from '../../models/User.js';

/** POST /quotations — save a dealer quote (tier price; GST per product). Valid 15 days unless validDays says otherwise. */
export const createWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items = [], validDays } = req.body;
    if (!dealerId) throw AppError.badRequest('dealerId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');
    const validUntil = validUntilFrom(validDays);
    const dealer = await Dealer.findOne({ _id: dealerId, businessId, isActive: true });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst, grandTotal } = await priceDealerItems(businessId, dealer, items);

    const ym = istYm();
    const seq = await nextSequence(`quotation:${businessId}:${ym}`);
    const quoteNo = `QUO/${ym}/${String(seq).padStart(4, '0')}`;

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
    if (req.query.status) filter.status = String(req.query.status);
    const [items, total] = await Promise.all([
        Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/** DELETE /quotations/:id — open quotes only; a converted one is the record of where an order came from. */
export const deleteWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const WS = { businessId, dealerId: { $exists: true, $ne: null } };
    const q = await Quotation.findOneAndDelete({ _id: req.params.id, ...WS, status: 'open' });
    if (!q) {
        const exists = await Quotation.exists({ _id: req.params.id, ...WS });
        throw exists ? AppError.badRequest('A converted quotation can not be deleted') : AppError.notFound('Quotation not found');
    }
    sendSuccess(res, { ok: true }, 'Quotation deleted');
});

/**
 * POST /quotations/:id/convert — turn an open, unexpired dealer quote into a real
 * Order (status pending) at the quoted prices. Only one request can convert it.
 * The order counts for the sales rep who made the quote; otherwise the usual rule
 * (the rep converting it, or the dealer's rep).
 */
export const convertWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const found = await Quotation.findOne({ _id: req.params.id, businessId, dealerId: { $exists: true, $ne: null } });
    if (!found) throw AppError.notFound('Quotation not found');
    if (found.status === 'converted') throw AppError.badRequest('This quotation is already converted');
    assertNotExpired(found);
    const dealer = await Dealer.findOne({ _id: found.dealerId, businessId, isActive: true });
    if (!dealer) throw AppError.badRequest('Dealer no longer exists');
    const maker = found.createdBy ? await User.findOne({ _id: found.createdBy, businessId, role: 'salesStaff', isActive: true }).select('_id').lean() : null;
    const paidNow = round2(Math.min(found.grandTotal, Math.max(0, Number(req.body.paidAmount) || 0)));
    await checkCreditLimit(req.user, req.body, new Types.ObjectId(String(businessId)), dealer, round2(found.grandTotal - paidNow));

    // Claim it: only one request moves it from open to converted.
    const quote = await Quotation.findOneAndUpdate({ _id: found._id, businessId, status: 'open' }, { $set: { status: 'converted' } }, { new: true });
    if (!quote) throw AppError.badRequest('This quotation is already converted');

    let order;
    try {
        const ym = istYm();
        const seq = await nextSequence(`order:${businessId}:${ym}`);
        const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
        const paidAmount = round2(Math.min(quote.grandTotal, Math.max(0, Number(req.body.paidAmount) || 0)));
        order = await Order.create({
            businessId, orderNo, dealerId: dealer._id, dealerName: dealer.name, dealerGstin: dealer.gstin,
            items: quote.items, subtotal: quote.subtotal, totalGst: quote.totalGst, total: quote.grandTotal,
            paidAmount, dueAmount: round2(quote.grandTotal - paidAmount), status: 'pending', source: 'manual',
            salesRepId: maker?._id ?? orderRepId(req.user, dealer),
        });
    } catch (e) {
        await Quotation.updateOne({ _id: quote._id, convertedInvoiceId: { $exists: false } }, { $set: { status: 'open' } }).catch(() => {});
        throw e;
    }
    await recordAdvancePayment(order, order.paidAmount, req.body.paymentMode ?? req.body.mode, req.user?._id);
    await Quotation.updateOne({ _id: quote._id }, { $set: { convertedInvoiceId: order._id, convertedInvoiceNo: order.orderNo } });
    sendCreated(res, order, 'Converted to order');
});
