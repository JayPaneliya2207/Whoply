import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import Quotation from '../../models/Quotation.js';
import PriceList from '../../models/PriceList.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

const tierPrice = (rows: any[], productId: string, tier: string, p: any): number => {
    const row = rows.find((r) => String(r.productId) === String(productId) && r.tier === tier);
    return row ? row.price : p.wholesalePrice || p.sellPrice;
};

/** Build GST-exclusive priced lines for a dealer's tier (no stock check). */
async function buildDealerLines(businessId: any, dealer: any, items: any[]) {
    const ids = items.map((i: any) => i.productId);
    const [products, priceRows] = await Promise.all([
        Product.find({ _id: { $in: ids }, businessId }),
        PriceList.find({ businessId, productId: { $in: ids }, tier: dealer.tier }).lean(),
    ]);
    const map = new Map(products.map((p) => [String(p._id), p]));
    let subtotal = 0, totalGst = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Quantity must be positive');
        const price = tierPrice(priceRows, String(p._id), dealer.tier, p);
        const base = price * qty;
        const gstAmount = +((base * (p.gstRate || 0)) / 100).toFixed(2);
        subtotal += base; totalGst += gstAmount;
        return { productId: p._id, name: p.name, hsn: p.hsn, unit: p.unit, quantity: qty, price, gstRate: p.gstRate || 0, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) };
    });
    return { lineItems, subtotal, totalGst };
}

/** POST /quotations — save a dealer quote (tier price + GST on top). */
export const createWsQuote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { dealerId, items = [], validDays } = req.body;
    if (!dealerId) throw AppError.badRequest('dealerId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('At least one item is required');
    const dealer = await Dealer.findOne({ _id: dealerId, businessId });
    if (!dealer) throw AppError.badRequest('Dealer not found');

    const { lineItems, subtotal, totalGst } = await buildDealerLines(businessId, dealer, items);
    const grandTotal = +(subtotal + totalGst).toFixed(2);

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`quotation:${businessId}:${ym}`);
    const quoteNo = `QUO/${ym}/${String(seq).padStart(4, '0')}`;
    const validUntil = validDays ? new Date(Date.now() + Number(validDays) * 86400000) : undefined;

    const quote = await Quotation.create({
        businessId, quoteNo, dealerId, customerName: dealer.name, customerMobile: dealer.mobile, customerGstin: dealer.gstin,
        items: lineItems, subtotal: +subtotal.toFixed(2), totalGst: +totalGst.toFixed(2), discount: 0, grandTotal,
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

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`order:${businessId}:${ym}`);
    const orderNo = `ORD/${ym}/${String(seq).padStart(4, '0')}`;
    const paidAmount = Number(req.body.paidAmount) || 0;
    const due = +(quote.grandTotal - paidAmount).toFixed(2);

    const order = await Order.create({
        businessId, orderNo, dealerId: dealer._id, dealerName: dealer.name, dealerGstin: dealer.gstin,
        items: quote.items, subtotal: quote.subtotal, totalGst: quote.totalGst, total: quote.grandTotal,
        paidAmount, dueAmount: due, status: 'pending', source: 'manual', salesRepId: dealer.assignedRepId,
    });
    quote.status = 'converted';
    quote.convertedInvoiceId = order._id;
    quote.convertedInvoiceNo = orderNo;
    await quote.save();
    sendCreated(res, order, 'Converted to order');
});
