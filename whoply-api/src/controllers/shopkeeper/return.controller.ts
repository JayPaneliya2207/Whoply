import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import CreditNote from '../../models/CreditNote.js';
import { applyStockChanges } from '../../utils/stock.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

/**
 * POST /returns — record a sales return (credit note) against an invoice.
 * body: { invoiceId, items:[{ productId, quantity }], reason?, refundMode: 'cash'|'udhar_adjust' }
 * Restores stock; udhar_adjust reduces the customer's credit balance by the return value.
 */
export const createReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { invoiceId, items = [], reason, refundMode = 'cash' } = req.body;
    if (!invoiceId) throw AppError.badRequest('invoiceId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('Select at least one item to return');

    const invoice = await Invoice.findOne({ _id: invoiceId, businessId });
    if (!invoice) throw AppError.notFound('Invoice not found');

    // How much of each product was already returned (across prior credit notes for this invoice).
    const priorNotes = await CreditNote.find({ businessId, invoiceId }).lean();
    const alreadyReturned = new Map<string, number>();
    priorNotes.forEach((n) => n.items.forEach((it) => alreadyReturned.set(String(it.productId), (alreadyReturned.get(String(it.productId)) || 0) + it.quantity)));

    let subtotal = 0;
    let totalGst = 0;
    const lineItems = items.map((i: any) => {
        const src = invoice.items.find((it) => String(it.productId) === String(i.productId));
        if (!src) throw AppError.badRequest('Item not part of this invoice');
        const qty = Number(i.quantity);
        if (qty <= 0) throw AppError.badRequest('Return quantity must be positive');
        const maxReturnable = src.quantity - (alreadyReturned.get(String(i.productId)) || 0);
        if (qty > maxReturnable) throw AppError.badRequest(`Only ${maxReturnable} of "${src.name}" can be returned`);
        const base = +(src.price * qty).toFixed(2);
        const gstAmount = +((base * src.gstRate) / 100).toFixed(2);
        subtotal += base;
        totalGst += gstAmount;
        return { productId: src.productId, name: src.name, hsn: src.hsn, unit: src.unit, quantity: qty, price: src.price, gstRate: src.gstRate, gstAmount, lineTotal: +(base + gstAmount).toFixed(2) };
    });
    const total = +(subtotal + totalGst).toFixed(2);

    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = await nextSequence(`creditnote:${businessId}:${ym}`);
    const creditNoteNo = `CN/${ym}/${String(seq).padStart(4, '0')}`;

    const note = await CreditNote.create({
        businessId, creditNoteNo, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId, customerName: invoice.customerName, customerMobile: invoice.customerMobile, customerGstin: invoice.customerGstin,
        items: lineItems, subtotal: +subtotal.toFixed(2), totalGst: +totalGst.toFixed(2), total, reason, refundMode, createdBy: req.user!._id,
    });

    // Restore stock + movements (batched)
    await applyStockChanges(
        businessId,
        lineItems.map((li) => ({ productId: li.productId, delta: li.quantity })),
        { reason: 'return', refType: 'CreditNote', refId: note._id }
    );

    // Refund handling
    let refund: any = { mode: refundMode, amount: total };
    if (refundMode === 'udhar_adjust' && invoice.customerId) {
        const customer = await Customer.findById(invoice.customerId);
        if (customer) {
            const applied = +Math.min(total, customer.creditBalance).toFixed(2);
            customer.creditBalance = +(customer.creditBalance - applied).toFixed(2);
            await customer.save();
            if (applied > 0) {
                await CreditLedger.create({ businessId, customerId: customer._id, type: 'repayment', amount: applied, balanceAfter: customer.creditBalance, refType: 'CreditNote', refId: note._id, note: `Return ${creditNoteNo}` });
            }
            refund = { mode: 'udhar_adjust', amount: applied, cashPortion: +(total - applied).toFixed(2) };
        }
    }

    sendCreated(res, { creditNote: note, refund }, 'Return recorded');
});

/** GET /returns — list credit notes (newest first). */
export const listReturns = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId };
    if (req.query.invoiceId) filter.invoiceId = new Types.ObjectId(String(req.query.invoiceId));
    const [items, total] = await Promise.all([
        CreditNote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CreditNote.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});
