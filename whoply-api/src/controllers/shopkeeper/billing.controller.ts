import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Product from '../../models/Product.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import StockMovement from '../../models/StockMovement.js';
import Business from '../../models/Business.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';

/**
 * POST /billing — create a POS sale.
 * body: { items: [{ productId, quantity, price? }], customerId?, discount?, paymentMode, paidAmount? }
 * Decrements stock, records movements, and posts to the udhar ledger for credit sales.
 */
export const createSale = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { items = [], customerId, discount = 0, paymentMode = 'cash', paidAmount } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('At least one item is required');

    // Load products in one query
    const ids = items.map((i: any) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, businessId });
    const map = new Map(products.map((p) => [String(p._id), p]));

    let subtotal = 0;
    let totalGst = 0;
    const lineItems = items.map((i: any) => {
        const p = map.get(String(i.productId));
        if (!p) throw AppError.badRequest(`Product ${i.productId} not found`);
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Quantity must be positive');
        if (p.currentStock < qty) throw AppError.badRequest(`Insufficient stock for ${p.name} (have ${p.currentStock})`);
        const price = i.price != null ? Number(i.price) : p.sellPrice;
        const base = price * qty;
        const gstAmount = +((base * p.gstRate) / 100).toFixed(2);
        subtotal += base;
        totalGst += gstAmount;
        return {
            productId: p._id,
            name: p.name,
            hsn: p.hsn,
            quantity: qty,
            unit: p.unit,
            price,
            gstRate: p.gstRate,
            gstAmount,
            lineTotal: +(base + gstAmount).toFixed(2),
        };
    });

    const grandTotal = +(subtotal + totalGst - Number(discount)).toFixed(2);
    const paid = paymentMode === 'credit' ? Number(paidAmount || 0) : paidAmount != null ? Number(paidAmount) : grandTotal;
    const due = +(grandTotal - paid).toFixed(2);
    const status = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'credit';

    if (due > 0 && !customerId) throw AppError.badRequest('A customer is required for credit (udhar) sales');

    // Invoice number: INV/<YYYYMM>/<seq>
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`invoice:${businessId}:${ym}`);
    const biz = await Business.findById(businessId).select('settings').lean();
    const prefix = biz?.settings?.invoicePrefix || 'INV';
    const invoiceNo = `${prefix}/${ym}/${String(seq).padStart(4, '0')}`;

    let customerName: string | undefined;
    if (customerId) {
        const c = await Customer.findOne({ _id: customerId, businessId });
        if (!c) throw AppError.badRequest('Customer not found');
        customerName = c.name;
    }

    const invoice = await Invoice.create({
        businessId,
        invoiceNo,
        customerId,
        customerName,
        items: lineItems,
        subtotal: +subtotal.toFixed(2),
        totalGst: +totalGst.toFixed(2),
        discount: Number(discount),
        grandTotal,
        paidAmount: paid,
        dueAmount: due,
        paymentMode,
        status,
        createdBy: req.user!._id,
    });

    // Decrement stock + movements
    for (const li of lineItems) {
        await Product.updateOne({ _id: li.productId }, { $inc: { currentStock: -li.quantity } });
        await StockMovement.create({
            businessId,
            productId: li.productId,
            reason: 'sale',
            quantity: -li.quantity,
            refType: 'Invoice',
            refId: invoice._id,
        });
    }

    // Udhar ledger for the due amount
    if (due > 0 && customerId) {
        const customer = await Customer.findById(customerId);
        if (customer) {
            customer.creditBalance += due;
            customer.loyaltyPoints += Math.floor(grandTotal / 100);
            await customer.save();
            await CreditLedger.create({
                businessId,
                customerId,
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

/** GET /billing/:id */
export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId }).lean();
    if (!invoice) throw AppError.notFound('Invoice not found');
    sendSuccess(res, invoice);
});
