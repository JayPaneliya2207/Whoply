import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import Business from '../../models/Business.js';
import { applyStockChanges } from '../../utils/stock.js';
import { priceLines, round2 } from '../../utils/tax.js';
import { resolvePayments } from '../../utils/payments.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/**
 * POST /billing — create a POS sale.
 * body: { items: [{ productId, quantity }], customerId?, discount?, payments?: [{ mode, amount }] }
 * `payments` is the money received by mode (several = a split bill); anything
 * unpaid goes on udhar. Older clients send { paymentMode, paidAmount } instead.
 * `discount` is rupees off the amount payable; it is taken off before GST (utils/tax.ts).
 * Unit prices always come from the product (sell price less its own discount %) —
 * a price sent by the client is ignored, so a stale cart can't bill an old price.
 * Decrements stock, records movements, and posts to the udhar ledger for credit sales.
 */
export const createSale = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], customerId, discount = 0, walkInName, walkInMobile } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('At least one item is required');
    if (!(Number(discount) >= 0)) throw AppError.badRequest('Discount cannot be negative');

    // Load products in one query
    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId });
    const map = new Map(products.map((p) => [String(p._id), p]));

    const rows = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (!(qty > 0)) throw AppError.badRequest('Quantity must be positive');
        if (p.currentStock < qty) throw AppError.badRequest(`Insufficient stock for ${p.name} (have ${p.currentStock})`);
        return { p, qty, unitPrice: round2(p.sellPrice * (1 - (p.discountPct || 0) / 100)) };
    });
    const priced = priceLines(
        rows.map((r) => ({ unitPrice: r.unitPrice, quantity: r.qty, gstRate: r.p.gstRate || 0, inclusive: r.p.priceIncludesGst === true })),
        Number(discount)
    );
    const lineItems = rows.map((r, k) => ({
        productId: r.p._id,
        name: r.p.name,
        hsn: r.p.hsn,
        quantity: r.qty,
        unit: r.p.unit,
        gstRate: r.p.gstRate || 0,
        ...priced.lines[k],
    }));
    const { subtotal, totalGst, grandTotal } = priced;
    const { payments, paid, due, status, paymentMode } = resolvePayments(req.body, grandTotal);

    // Resolve the customer. A walk-in with a mobile is auto-matched to an existing
    // customer (fetch) or saved as a new one (add), so udhar & history stay linked.
    let resolvedCustomerId = customerId;
    let customerName: string | undefined;
    let customerMobile: string | undefined;
    let customerGstin: string | undefined;
    const bodyGstin = (req.body.customerGstin || req.body.walkInGstin || '').toString().trim().toUpperCase() || undefined;
    if (customerId) {
        const c = await Customer.findOne({ _id: customerId, businessId });
        if (!c) throw AppError.badRequest('Customer not found');
        customerName = c.name;
        customerMobile = c.mobile;
        customerGstin = c.gstin || bodyGstin;
    } else if (walkInMobile) {
        const mobile = String(walkInMobile).replace(/\D/g, '');
        let c = await Customer.findOne({ businessId, mobile });
        if (!c) {
            c = await Customer.create({ businessId, name: walkInName?.trim() || 'Walk-in', mobile, gstin: bodyGstin });
        } else if (walkInName?.trim() && (!c.name || c.name === 'Walk-in')) {
            c.name = walkInName.trim();
            if (bodyGstin && !c.gstin) c.gstin = bodyGstin;
            await c.save();
        }
        resolvedCustomerId = c._id;
        customerName = c.name;
        customerMobile = c.mobile;
        customerGstin = c.gstin || bodyGstin;
    } else if (walkInName) {
        customerName = walkInName.trim();
        customerGstin = bodyGstin;
    }

    if (due > 0 && !resolvedCustomerId) throw AppError.badRequest('A mobile number is required for credit (udhar) sales');

    // Invoice number: INV/<YYYYMM>/<seq>
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`invoice:${businessId}:${ym}`);
    const biz = await Business.findById(businessId).select('settings').lean();
    const prefix = biz?.settings?.invoicePrefix || 'INV';
    const invoiceNo = `${prefix}/${ym}/${String(seq).padStart(4, '0')}`;

    const invoice = await Invoice.create({
        businessId,
        invoiceNo,
        customerId: resolvedCustomerId,
        customerName,
        customerMobile,
        customerGstin,
        items: lineItems,
        subtotal,
        totalGst,
        discount: priced.discount,
        grandTotal,
        paidAmount: paid,
        dueAmount: due,
        paymentMode,
        payments,
        status,
        createdBy: req.user!._id,
    });

    // Decrement stock + movements — batched, so a 20-item bill costs 3 round-trips, not 40.
    await applyStockChanges(
        businessId,
        lineItems.map((li) => ({ productId: li.productId, delta: -li.quantity })),
        { reason: 'sale', refType: 'Invoice', refId: invoice._id }
    );

    // Udhar ledger for the due amount
    if (due > 0 && resolvedCustomerId) {
        const customer = await Customer.findById(resolvedCustomerId);
        if (customer) {
            customer.creditBalance += due;
            customer.loyaltyPoints += Math.floor(grandTotal / 100);
            await customer.save();
            await CreditLedger.create({
                businessId,
                customerId: resolvedCustomerId,
                type: 'credit',
                amount: due,
                balanceAfter: customer.creditBalance,
                refType: 'Invoice',
                refId: invoice._id,
                note: `Credit sale ${invoiceNo}`,
            });
        }
    }

    sendCreated(res, invoice, 'Sale recorded');
});

/** GET /billing/:id/einvoice — e-invoice (IRP schema) JSON payload for portal upload. */
export const getEInvoiceJson = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [inv, biz] = await Promise.all([
        Invoice.findOne({ _id: req.params.id, businessId }),
        Business.findById(businessId),
    ]);
    if (!inv) throw AppError.notFound('Invoice not found');
    if (!biz?.gstin) throw AppError.badRequest('Set your GSTIN in Settings → Shop details before generating an e-invoice');
    const { buildEInvoiceJson, invoiceToGstDoc } = await import('../../utils/gstJson.js');
    sendSuccess(res, buildEInvoiceJson(biz, invoiceToGstDoc(inv)));
});

/** POST /billing/:id/eway — e-way bill JSON. body: { vehicleNo, distance, transMode, transporterName, transporterId } */
export const getEWayBillJson = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [inv, biz] = await Promise.all([
        Invoice.findOne({ _id: req.params.id, businessId }),
        Business.findById(businessId),
    ]);
    if (!inv) throw AppError.notFound('Invoice not found');
    if (!biz?.gstin) throw AppError.badRequest('Set your GSTIN in Settings → Shop details before generating an e-way bill');
    const { buildEWayBillJson, invoiceToGstDoc } = await import('../../utils/gstJson.js');
    sendSuccess(res, buildEWayBillJson(biz, invoiceToGstDoc(inv), {
        vehicleNo: req.body.vehicleNo, distance: Number(req.body.distance) || 0, transMode: req.body.transMode,
        transporterName: req.body.transporterName, transporterId: req.body.transporterId,
    }));
});

/** GET /billing — list invoices */
export const listInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
        Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Invoice.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/** GET /billing/:id — invoice + shop details (for printable bill / WhatsApp) */
export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId }).lean();
    if (!invoice) throw AppError.notFound('Invoice not found');
    const business = await Business.findById(businessId)
        .select('name ownerName mobile countryCode gstin address city state')
        .lean();
    sendSuccess(res, { ...invoice, business });
});

/** POST /billing/:id/mark-sent — record that the bill was shared on WhatsApp */
export const markBillSent = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const invoice = await Invoice.findOneAndUpdate(
        { _id: req.params.id, businessId },
        { whatsappSentAt: new Date() },
        { new: true }
    );
    if (!invoice) throw AppError.notFound('Invoice not found');
    sendSuccess(res, { _id: invoice._id, whatsappSentAt: invoice.whatsappSentAt });
});
