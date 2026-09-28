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
import { netLineValue, round2 } from '../../utils/tax.js';
import { lineQty } from '../../utils/qty.js';
import { nextSequence } from '../../models/Counter.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { Types } from 'mongoose';

/**
 * POST /returns — record a sales return (credit note) against an invoice.
 * body: { invoiceId, items:[{ productId, quantity }], reason?, refundMode: 'cash'|'udhar_adjust' }
 * Restores stock. The return is valued at what was charged (after the bill
 * discount) and settled in this order:
 *   1. it cancels what is still unpaid on THIS bill (no cash for unpaid goods);
 *   2. udhar_adjust: the rest reduces the customer's other udhar;
 *   3. anything left is paid back in cash (`cashRefund`, subtracted in day-close).
 * Udhar reductions are ledger type 'return', so they never count as money collected.
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
        const qty = lineQty(i.quantity, src);
        const maxReturnable = src.quantity - (alreadyReturned.get(String(i.productId)) || 0);
        if (qty > maxReturnable) throw AppError.badRequest(`Only ${maxReturnable} of "${src.name}" can be returned`);
        // Value the units at what the customer was charged — bill discount included.
        const net = netLineValue(invoice, src);
        const base = round2((net.taxable * qty) / src.quantity);
        const gstAmount = round2((net.gst * qty) / src.quantity);
        subtotal += base;
        totalGst += gstAmount;
        return { productId: src.productId, name: src.name, hsn: src.hsn, unit: src.unit, quantity: qty, price: src.price, gstRate: src.gstRate, gstAmount, taxableValue: base, lineTotal: round2(base + gstAmount) };
    });
    const total = round2(subtotal + totalGst);

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

    // Settle the return value: this bill's due first, then (udhar_adjust) other udhar, then cash.
    let remaining = total;
    let billAdjusted = 0;
    let udharAdjusted = 0;
    const customer = invoice.customerId ? await Customer.findById(invoice.customerId) : null;

    if (invoice.dueAmount > 0) {
        billAdjusted = round2(Math.min(remaining, invoice.dueAmount));
        invoice.dueAmount = round2(invoice.dueAmount - billAdjusted);
        invoice.status = invoice.dueAmount <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partial' : 'credit';
        await invoice.save();
        remaining = round2(remaining - billAdjusted);
    }
    if (refundMode === 'udhar_adjust' && customer && remaining > 0) {
        udharAdjusted = round2(Math.min(remaining, Math.max(0, customer.creditBalance - billAdjusted)));
        remaining = round2(remaining - udharAdjusted);
    }
    const fromUdhar = round2(billAdjusted + udharAdjusted);
    if (customer && fromUdhar > 0) {
        customer.creditBalance = round2(Math.max(0, customer.creditBalance - fromUdhar));
        await customer.save();
        await CreditLedger.create({ businessId, customerId: customer._id, type: 'return', amount: fromUdhar, balanceAfter: customer.creditBalance, refType: 'CreditNote', refId: note._id, note: `Return ${creditNoteNo}` });
    }
    const cashRefund = remaining;
    if (cashRefund > 0) {
        note.cashRefund = cashRefund;
        await note.save();
    }

    const refund = { mode: refundMode, amount: total, billAdjusted, udharAdjusted, cashRefund };
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
