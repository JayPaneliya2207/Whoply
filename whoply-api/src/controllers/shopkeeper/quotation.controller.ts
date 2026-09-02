import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Invoice from '../../models/Invoice.js';
import Quotation from '../../models/Quotation.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import Business from '../../models/Business.js';
import { applyStockChanges } from '../../utils/stock.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** Build priced line items from a product list (no stock check — quotes are estimates). */
async function buildLines(businessId: any, items: any[]) {
    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId });
    const map = new Map(products.map((p) => [String(p._id), p]));
    let subtotal = 0, totalGst = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Quantity must be positive');
        const price = i.price != null ? Number(i.price) : p.sellPrice;
        const base = price * qty;
        const gstAmount = +((base * p.gstRate) / 100).toFixed(2);
        subtotal += base;
        totalGst += gstAmount;
        return { productId: p._id, name: p.name, hsn: p.hsn, quantity: qty, unit: p.unit, price, gstRate: p.gstRate, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) };
    });
    return { lineItems, subtotal, totalGst };
}

/** POST /quotations — save a price estimate (no stock/payment side effects). */
export const createQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], discount = 0, customerId, walkInName, walkInMobile, customerGstin, validDays } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('At least one item is required');

    const { lineItems, subtotal, totalGst } = await buildLines(businessId, items);
    const grandTotal = +(subtotal + totalGst - Number(discount)).toFixed(2);

    let customerName = walkInName?.trim();
    let customerMobile = walkInMobile ? String(walkInMobile).replace(/\D/g, '') : undefined;
    if (customerId) {
        const c = await Customer.findOne({ _id: customerId, businessId }).lean();
        if (c) { customerName = c.name; customerMobile = c.mobile; }
    }

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`quotation:${businessId}:${ym}`);
    const quoteNo = `QUO/${ym}/${String(seq).padStart(4, '0')}`;
    const validUntil = validDays ? new Date(Date.now() + Number(validDays) * 86400000) : undefined;

    const quote = await Quotation.create({
        businessId, quoteNo, customerId: customerId || undefined, customerName, customerMobile,
        customerGstin: (customerGstin || '').toString().trim().toUpperCase() || undefined,
        items: lineItems, subtotal: +subtotal.toFixed(2), totalGst: +totalGst.toFixed(2), discount: Number(discount), grandTotal,
        validUntil, createdBy: req.user!._id,
    });
    sendCreated(res, quote, 'Quotation saved');
});

export const listQuotations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
        Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

export const getQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const quote = await Quotation.findOne({ _id: req.params.id, businessId }).lean();
    if (!quote) throw AppError.notFound('Quotation not found');
    const biz = await Business.findById(businessId).lean();
    sendSuccess(res, { ...quote, business: biz });
});

export const deleteQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const q = await Quotation.findOneAndDelete({ _id: req.params.id, businessId });
    if (!q) throw AppError.notFound('Quotation not found');
    sendSuccess(res, { ok: true }, 'Quotation deleted');
});

/**
 * POST /quotations/:id/convert — turn an open quote into a real Invoice.
 * body: { paymentMode?, paidAmount? }. Validates stock, decrements it, posts udhar for any due.
 */
export const convertQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { paymentMode = 'cash', paidAmount } = req.body;
    const quote = await Quotation.findOne({ _id: req.params.id, businessId });
    if (!quote) throw AppError.notFound('Quotation not found');
    if (quote.status === 'converted') throw AppError.badRequest('This quotation is already converted');

    // Re-validate stock at conversion time — one query for the whole quote, not one per line.
    const stockDocs = await Product.find({ _id: { $in: quote.items.map((li) => li.productId) }, businessId })
        .select('currentStock')
        .lean();
    const stockMap = new Map(stockDocs.map((p) => [String(p._id), p.currentStock]));
    for (const li of quote.items) {
        const have = stockMap.get(String(li.productId));
        if (have == null) throw AppError.badRequest(`Product "${li.name}" no longer exists`);
        if (have < li.quantity) throw AppError.badRequest(`Insufficient stock for ${li.name} (have ${have})`);
    }

    // Resolve customer (find-or-create by mobile so udhar & history link).
    let resolvedCustomerId = quote.customerId as any;
    if (!resolvedCustomerId && quote.customerMobile) {
        let c = await Customer.findOne({ businessId, mobile: quote.customerMobile });
        if (!c) c = await Customer.create({ businessId, name: quote.customerName || 'Walk-in', mobile: quote.customerMobile, gstin: quote.customerGstin });
        resolvedCustomerId = c._id;
    }

    const grandTotal = quote.grandTotal;
    const paid = paymentMode === 'credit' ? Number(paidAmount || 0) : paidAmount != null ? Number(paidAmount) : grandTotal;
    const due = +(grandTotal - paid).toFixed(2);
    const status = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'credit';
    if (due > 0 && !resolvedCustomerId) throw AppError.badRequest('A customer mobile is required for a credit (udhar) sale');

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`invoice:${businessId}:${ym}`);
    const biz = await Business.findById(businessId).select('settings').lean();
    const invoiceNo = `${biz?.settings?.invoicePrefix || 'INV'}/${ym}/${String(seq).padStart(4, '0')}`;

    const invoice = await Invoice.create({
        businessId, invoiceNo, customerId: resolvedCustomerId, customerName: quote.customerName,
        customerMobile: quote.customerMobile, customerGstin: quote.customerGstin, items: quote.items,
        subtotal: quote.subtotal, totalGst: quote.totalGst, discount: quote.discount, grandTotal,
        paidAmount: paid, dueAmount: due, paymentMode, status, createdBy: req.user!._id,
    });

    await applyStockChanges(
        businessId,
        quote.items.map((li) => ({ productId: li.productId, delta: -li.quantity })),
        { reason: 'sale', refType: 'Invoice', refId: invoice._id }
    );
    if (due > 0 && resolvedCustomerId) {
        const customer = await Customer.findById(resolvedCustomerId);
        if (customer) {
            customer.creditBalance += due;
            customer.loyaltyPoints += Math.floor(grandTotal / 100);
            await customer.save();
            await CreditLedger.create({ businessId, customerId: resolvedCustomerId, type: 'credit', amount: due, balanceAfter: customer.creditBalance, refType: 'Invoice', refId: invoice._id, note: `Credit sale ${invoiceNo}` });
        }
    }

    quote.status = 'converted';
    quote.convertedInvoiceId = invoice._id;
    quote.convertedInvoiceNo = invoiceNo;
    await quote.save();
    sendCreated(res, invoice, 'Converted to invoice');
});
