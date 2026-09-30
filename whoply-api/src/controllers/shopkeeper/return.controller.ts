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
import { istYm } from '../../utils/ist.js';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Units already returned per productId: the stored count, else (older documents) summed from credit notes. */
export async function returnedSoFar(stored: Record<string, number> | undefined, notes: () => Promise<{ items: { productId: unknown; quantity: number }[] }[]>) {
    const out = new Map<string, number>();
    if (stored && typeof stored === 'object') {
        for (const [k, v] of Object.entries(stored)) out.set(k, Number(v) || 0);
        return out;
    }
    for (const n of await notes()) for (const it of n.items) out.set(String(it.productId), round3((out.get(String(it.productId)) || 0) + it.quantity));
    return out;
}

/** The running count after this return. */
export const addReturned = (before: Map<string, number>, adding: Map<string, number>) => {
    const out: Record<string, number> = Object.fromEntries(before);
    for (const [k, v] of adding) out[k] = round3((out[k] || 0) + v);
    return out;
};
import { settleDueBills, settledNote } from '../../utils/udhar.js';

/**
 * POST /returns — record a sales return (credit note) against an invoice.
 * body: { invoiceId, items:[{ productId, quantity }], reason?, refundMode: 'cash'|'udhar_adjust' }
 * Restores stock. The return is valued at what was charged (after the bill
 * discount) and settled in this order:
 *   1. it cancels what is still unpaid on THIS bill (no cash for unpaid goods);
 *   2. udhar_adjust: the rest reduces the customer's other udhar (clearing their
 *      oldest other due bills — utils/udhar.ts);
 *   3. anything left is paid back in cash (`cashRefund`, subtracted in day-close).
 * Udhar reductions are ledger type 'return', so they never count as money collected.
 */
export const createReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { invoiceId, items = [], reason, refundMode = 'cash' } = req.body;
    if (!invoiceId) throw AppError.badRequest('invoiceId is required');
    if (!Array.isArray(items) || !items.length) throw AppError.badRequest('Select at least one item to return');
    if (!['cash', 'udhar_adjust'].includes(refundMode)) throw AppError.badRequest('Refund must be cash or udhar_adjust');
    if (reason != null && String(reason).length > 200) throw AppError.badRequest('Reason can be at most 200 characters');

    const invoice = await Invoice.findOne({ _id: invoiceId, businessId });
    if (!invoice) throw AppError.notFound('Invoice not found');
    const rev = invoice.returnsRev || 0;

    // How much of each product was already returned: the bill's own running count (bills
    // returned on before it existed: add up their credit notes).
    const alreadyReturned = await returnedSoFar(invoice.returned, () => CreditNote.find({ businessId, invoiceId: invoice._id }).select('items.productId items.quantity').lean());

    // Asking for the same product on two lines counts as one request for the total.
    const wanted = new Map<string, number>();
    for (const i of items) {
        const src = invoice.items.find((it) => String(it.productId) === String(i?.productId));
        if (!src) throw AppError.badRequest('Item not part of this invoice');
        const key = String(src.productId);
        wanted.set(key, round3((wanted.get(key) || 0) + lineQty(i.quantity, src)));
    }

    // A product may sit on several bill lines: units come back line by line (after the
    // units earlier returns took), each valued at what that line charged — bill discount included.
    let subtotal = 0;
    let totalGst = 0;
    const lineItems: any[] = [];
    for (const [key, qty] of wanted) {
        const lines = invoice.items.filter((it) => String(it.productId) === key);
        const done = alreadyReturned.get(key) || 0;
        const maxReturnable = round3(lines.reduce((s, it) => s + it.quantity, 0) - done);
        if (qty > maxReturnable + 1e-9) throw AppError.badRequest(`Only ${Math.max(0, maxReturnable)} of "${lines[0].name}" can be returned`);
        let skip = done;
        let left = qty;
        for (const src of lines) {
            const free = src.quantity - Math.min(src.quantity, skip);
            skip = Math.max(0, skip - src.quantity);
            const take = round3(Math.min(free, left));
            if (take <= 0) continue;
            left = round3(left - take);
            const net = netLineValue(invoice, src);
            const base = round2((net.taxable * take) / src.quantity);
            const gstAmount = round2((net.gst * take) / src.quantity);
            subtotal += base;
            totalGst += gstAmount;
            lineItems.push({ productId: src.productId, name: src.name, hsn: src.hsn, unit: src.unit, quantity: take, price: src.price, gstRate: src.gstRate, gstAmount, taxableValue: base, lineTotal: round2(base + gstAmount) });
        }
    }
    const total = round2(subtotal + totalGst);

    // One return per bill at a time: the new running count is saved in the same step as the
    // returnsRev bump, and only if returnsRev is still what we read. A return that read the
    // bill before another one landed is sent back to try again — it can't double-count.
    const newCount = addReturned(alreadyReturned, wanted);
    const claim = await Invoice.updateOne({ _id: invoice._id, businessId, returnsRev: rev === 0 ? { $in: [0, null] } : rev }, { $set: { returnsRev: rev + 1, returned: newCount } });
    if (claim.modifiedCount !== 1) throw AppError.conflict('Another return on this bill was just saved — open the bill again');

    const ym = istYm();
    const seq = await nextSequence(`creditnote:${businessId}:${ym}`);
    const creditNoteNo = `CN/${ym}/${String(seq).padStart(4, '0')}`;

    const note = await CreditNote.create({
        businessId, creditNoteNo, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId, customerName: invoice.customerName, customerMobile: invoice.customerMobile, customerGstin: invoice.customerGstin,
        items: lineItems, subtotal: round2(subtotal), totalGst: round2(totalGst), total, reason, refundMode, createdBy: req.user!._id,
    });

    // Restore stock + movements (batched)
    await applyStockChanges(
        businessId,
        lineItems.map((li) => ({ productId: li.productId, delta: li.quantity })),
        { reason: 'return', refType: 'CreditNote', refId: note._id }
    );

    // 1. This bill's own due. Set only if the due is still what we read, so a repayment
    //    landing at the same moment is never overwritten.
    let billAdjusted = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
        const cur = await Invoice.findById(invoice._id).select('dueAmount').lean();
        const due = cur?.dueAmount || 0;
        const adj = round2(Math.min(total, due));
        if (adj <= 0) break;
        const newDue = round2(due - adj);
        const r = await Invoice.updateOne({ _id: invoice._id, dueAmount: due }, { $set: { dueAmount: newDue, status: newDue <= 0 ? 'paid' : 'partial' } });
        if (r.modifiedCount === 1) { billAdjusted = adj; break; }
    }
    let remaining = round2(total - billAdjusted);

    // 2. udhar_adjust: the rest reduces the customer's other udhar. 3. Anything left is cash.
    const customer = invoice.customerId ? await Customer.findOne({ _id: invoice.customerId, businessId }).select('creditBalance').lean() : null;
    let udharAdjusted = 0;
    if (refundMode === 'udhar_adjust' && customer && remaining > 0) {
        udharAdjusted = round2(Math.min(remaining, Math.max(0, customer.creditBalance - billAdjusted)));
        remaining = round2(remaining - udharAdjusted);
    }
    const fromUdhar = round2(billAdjusted + udharAdjusted);
    const points = Math.floor(total / 100); // the loyalty points this much shopping earned
    if (customer && (fromUdhar > 0 || points > 0)) {
        // One atomic update — a bill or repayment for the same customer at the same moment isn't lost.
        const updated = await Customer.findOneAndUpdate(
            { _id: customer._id, businessId },
            [{ $set: {
                creditBalance: { $max: [0, { $round: [{ $subtract: ['$creditBalance', fromUdhar] }, 2] }] },
                loyaltyPoints: { $max: [0, { $subtract: [{ $ifNull: ['$loyaltyPoints', 0] }, points] }] },
            } }],
            { new: true, updatePipeline: true }
        );
        if (updated && fromUdhar > 0) {
            // What went against their other udhar clears their other due bills, oldest first.
            const settled = udharAdjusted > 0 ? await settleDueBills(businessId, customer._id, udharAdjusted, { excludeInvoiceId: invoice._id }) : [];
            await CreditLedger.create({ businessId, customerId: customer._id, type: 'return', amount: fromUdhar, balanceAfter: updated.creditBalance, refType: 'CreditNote', refId: note._id, note: [`Return ${creditNoteNo}`, settledNote(settled)].filter(Boolean).join(' — ') });
        }
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
    if (req.query.invoiceId) {
        if (!Types.ObjectId.isValid(String(req.query.invoiceId))) throw AppError.badRequest('Invalid invoiceId');
        filter.invoiceId = new Types.ObjectId(String(req.query.invoiceId));
    }
    const [items, total] = await Promise.all([
        CreditNote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CreditNote.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});
