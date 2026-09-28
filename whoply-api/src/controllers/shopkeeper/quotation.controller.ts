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
import { priceLines, round2 } from '../../utils/tax.js';
import { resolvePayments } from '../../utils/payments.js';
import { lineQty } from '../../utils/qty.js';
import { normalizePhone } from '../../utils/phone.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/**
 * Build priced line items from a product list (no stock check — quotes are
 * estimates). Priced exactly like a POS bill: sell price less the product's own
 * discount %, GST per the product's inclusive flag, bill discount before tax.
 */
async function buildLines(businessId: any, items: any[], discount: number) {
    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId });
    const map = new Map(products.map((p) => [String(p._id), p]));
    const rows = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = lineQty(i.quantity, p);
        return { p, qty, unitPrice: round2(p.sellPrice * (1 - (p.discountPct || 0) / 100)) };
    });
    const priced = priceLines(
        rows.map((r) => ({ unitPrice: r.unitPrice, quantity: r.qty, gstRate: r.p.gstRate || 0, inclusive: r.p.priceIncludesGst === true })),
        discount
    );
    const lineItems = rows.map((r, k) => ({
        productId: r.p._id, name: r.p.name, hsn: r.p.hsn, quantity: r.qty, unit: r.p.unit, gstRate: r.p.gstRate || 0, ...priced.lines[k],
    }));
    return { lineItems, ...priced };
}

/** POST /quotations — save a price estimate (no stock/payment side effects). */
export const createQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], discount = 0, customerId, walkInName, walkInMobile, customerGstin, validDays } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('At least one item is required');
    if (!(Number(discount) >= 0)) throw AppError.badRequest('Discount cannot be negative');

    const { lineItems, subtotal, totalGst, discount: preTaxDiscount, grandTotal } = await buildLines(businessId, items, Number(discount));

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
        items: lineItems, subtotal, totalGst, discount: preTaxDiscount, grandTotal,
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
 * body: { payments?: [{ mode, amount }] } (or the older { paymentMode, paidAmount }).
 * Validates stock, decrements it, posts udhar for any due.
 */
export const convertQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
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
        const mobile = normalizePhone(quote.customerMobile);
        let c = await Customer.findOne({ businessId, mobile, isActive: true });
        if (!c) c = await Customer.create({ businessId, name: quote.customerName || 'Walk-in', mobile, gstin: quote.customerGstin });
        resolvedCustomerId = c._id;
    }

    const grandTotal = quote.grandTotal;
    const { payments, paid, due, status, paymentMode } = resolvePayments(req.body, grandTotal);
    if (due > 0 && !resolvedCustomerId) throw AppError.badRequest('A customer mobile is required for a credit (udhar) sale');

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`invoice:${businessId}:${ym}`);
    const biz = await Business.findById(businessId).select('settings').lean();
    const invoiceNo = `${biz?.settings?.invoicePrefix || 'INV'}/${ym}/${String(seq).padStart(4, '0')}`;

    const invoice = await Invoice.create({
        businessId, invoiceNo, customerId: resolvedCustomerId, customerName: quote.customerName,
        customerMobile: quote.customerMobile, customerGstin: quote.customerGstin, items: quote.items,
        subtotal: quote.subtotal, totalGst: quote.totalGst, discount: quote.discount, grandTotal,
        paidAmount: paid, dueAmount: due, paymentMode, payments, status, createdBy: req.user!._id,
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
