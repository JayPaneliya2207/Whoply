import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Invoice from '../../models/Invoice.js';
import Quotation from '../../models/Quotation.js';
import Customer from '../../models/Customer.js';
import Business from '../../models/Business.js';
import { takeStockThenSave, postSaleToCustomer } from '../../utils/sale.js';
import { validUntilFrom, assertNotExpired } from '../../utils/quote.js';
import { Types } from 'mongoose';
import { priceLines, round2 } from '../../utils/tax.js';
import { resolvePayments } from '../../utils/payments.js';
import { lineQty } from '../../utils/qty.js';
import { normalizePhone } from '../../utils/phone.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { istYm } from '../../utils/ist.js';

/**
 * Build priced line items from a product list (no stock check — quotes are
 * estimates). Priced exactly like a POS bill: sell price less the product's own
 * discount %, GST per the product's inclusive flag, bill discount before tax.
 */
async function buildLines(businessId: any, items: any[], discount: number) {
    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId, isActive: true });
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

/** Retail quotes only — wholesale (dealer) quotes live in the same collection but convert to orders. */
const RETAIL = { dealerId: null };

/** POST /quotations — save a price estimate (no stock/payment side effects). Valid 15 days unless validDays says otherwise. */
export const createQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], discount = 0, customerId, walkInName, walkInMobile, customerGstin, validDays } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('At least one item is required');
    if (!(Number(discount) >= 0)) throw AppError.badRequest('Discount cannot be negative');
    const validUntil = validUntilFrom(validDays);

    const { lineItems, subtotal, totalGst, discount: preTaxDiscount, grandTotal } = await buildLines(businessId, items, Number(discount));

    const bodyGstin = (customerGstin || '').toString().trim().toUpperCase() || undefined;
    let customerName = walkInName?.trim();
    let customerMobile = walkInMobile ? normalizePhone(walkInMobile) : undefined;
    let gstin = bodyGstin;
    if (customerId) {
        // Only this shop's own, current customers — never another shop's id.
        const c = await Customer.findOne({ _id: customerId, businessId, isActive: true }).lean();
        if (!c) throw AppError.badRequest('Customer not found');
        customerName = c.name;
        customerMobile = c.mobile;
        gstin = c.gstin || bodyGstin;
    }

    const ym = istYm();
    const seq = await nextSequence(`quotation:${businessId}:${ym}`);
    const quoteNo = `QUO/${ym}/${String(seq).padStart(4, '0')}`;

    const quote = await Quotation.create({
        businessId, quoteNo, customerId: customerId || undefined, customerName, customerMobile, customerGstin: gstin,
        items: lineItems, subtotal, totalGst, discount: preTaxDiscount, grandTotal,
        validUntil, createdBy: req.user!._id,
    });
    sendCreated(res, quote, 'Quotation saved');
});

export const listQuotations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, ...RETAIL };
    if (req.query.status) filter.status = String(req.query.status);
    const [items, total] = await Promise.all([
        Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

export const getQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const quote = await Quotation.findOne({ _id: req.params.id, businessId, ...RETAIL }).lean();
    if (!quote) throw AppError.notFound('Quotation not found');
    // Only what the printed estimate shows — not bank details or settings.
    const biz = await Business.findById(businessId).select('name ownerName mobile countryCode gstin address city state pincode upiId').lean();
    sendSuccess(res, { ...quote, business: biz });
});

/** DELETE /quotations/:id — open quotes only; a converted one is the record of where a bill came from. */
export const deleteQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const q = await Quotation.findOneAndDelete({ _id: req.params.id, businessId, ...RETAIL, status: 'open' });
    if (!q) {
        const exists = await Quotation.exists({ _id: req.params.id, businessId, ...RETAIL });
        throw exists ? AppError.badRequest('A converted quotation can not be deleted') : AppError.notFound('Quotation not found');
    }
    sendSuccess(res, { ok: true }, 'Quotation deleted');
});

/**
 * POST /quotations/:id/convert — turn an open, unexpired quote into a real Invoice
 * at the quoted prices. body: { payments?: [{ mode, amount }] } (or the older
 * { paymentMode, paidAmount }); anything unpaid goes on udhar.
 * Only one request can convert a quote (a double tap or a second phone gets
 * "already converted"); stock is taken atomically and never goes below zero.
 */
export const convertQuotation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const found = await Quotation.findOne({ _id: req.params.id, businessId, ...RETAIL });
    if (!found) throw AppError.notFound('Quotation not found');
    if (found.status === 'converted') throw AppError.badRequest('This quotation is already converted');
    assertNotExpired(found);
    const grandTotal = found.grandTotal;
    const { payments, paid, due, status, paymentMode } = resolvePayments(req.body, grandTotal);

    // Claim it: only one request moves it from open to converted.
    const quote = await Quotation.findOneAndUpdate({ _id: found._id, businessId, status: 'open' }, { $set: { status: 'converted' } }, { new: true });
    if (!quote) throw AppError.badRequest('This quotation is already converted');

    let invoice;
    let customerId: Types.ObjectId | undefined;
    try {
        // The quote's customer if still on the books, else find-or-create by mobile (udhar & history link).
        let c = quote.customerId ? await Customer.findOne({ _id: quote.customerId, businessId, isActive: true }) : null;
        if (!c && quote.customerMobile) {
            const mobile = normalizePhone(quote.customerMobile);
            c = (await Customer.findOne({ businessId, mobile, isActive: true })) || (await Customer.create({ businessId, name: quote.customerName || 'Walk-in', mobile, gstin: quote.customerGstin }));
        }
        if (due > 0 && !c) throw AppError.badRequest('A customer mobile is required for a credit (udhar) sale');
        customerId = c?._id;

        const invoiceId = new Types.ObjectId();
        invoice = await takeStockThenSave(businessId, quote.items.map((li) => ({ productId: li.productId, quantity: li.quantity, name: li.name })), invoiceId, async () => {
            const ym = istYm();
            const seq = await nextSequence(`invoice:${businessId}:${ym}`);
            const biz = await Business.findById(businessId).select('settings').lean();
            return Invoice.create({
                _id: invoiceId, businessId,
                invoiceNo: `${biz?.settings?.invoicePrefix || 'INV'}/${ym}/${String(seq).padStart(4, '0')}`,
                customerId, customerName: c?.name || quote.customerName, customerMobile: c?.mobile || quote.customerMobile,
                customerGstin: c?.gstin || quote.customerGstin, items: quote.items,
                subtotal: quote.subtotal, totalGst: quote.totalGst, discount: quote.discount, grandTotal,
                paidAmount: paid, dueAmount: due, paymentMode, payments, status, createdBy: req.user!._id,
            });
        });
    } catch (e) {
        // Nothing was billed — the quote is open again.
        await Quotation.updateOne({ _id: quote._id, convertedInvoiceId: { $exists: false } }, { $set: { status: 'open' } }).catch(() => {});
        throw e;
    }

    if (customerId) await postSaleToCustomer(businessId, customerId, { due, grandTotal, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo });
    await Quotation.updateOne({ _id: quote._id }, { $set: { convertedInvoiceId: invoice._id, convertedInvoiceNo: invoice.invoiceNo } });
    sendCreated(res, invoice, 'Converted to invoice');
});
