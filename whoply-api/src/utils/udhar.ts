/**
 * Udhar money that comes in later — a repayment, or a return adjusted against
 * udhar — lowers the customer's balance AND must clear their bills, or old
 * bills keep showing "due" after the customer has paid. Oldest bill first.
 *
 * Only `dueAmount` and `status` change, never `paidAmount` / `payments`: those
 * record what was paid at the counter when the bill was made, and day-close
 * counts later udhar money from the ledger instead (so it isn't counted twice).
 */
import type { Types } from 'mongoose';
import Invoice from '../models/Invoice.js';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SettledBill { invoiceId: Types.ObjectId; invoiceNo: string; cleared: number; dueAfter: number }

export async function settleDueBills(
    businessId: Types.ObjectId | string,
    customerId: Types.ObjectId | string,
    amount: number,
    opts: { excludeInvoiceId?: Types.ObjectId | string } = {}
): Promise<SettledBill[]> {
    let left = r2(amount);
    if (left <= 0) return [];
    const bills = await Invoice.find({
        businessId,
        customerId,
        dueAmount: { $gt: 0 },
        ...(opts.excludeInvoiceId && { _id: { $ne: opts.excludeInvoiceId } }),
    })
        .sort({ createdAt: 1, _id: 1 })
        .select('invoiceNo dueAmount grandTotal')
        .lean();

    const out: SettledBill[] = [];
    for (const b of bills) {
        if (left <= 0) break;
        const cleared = r2(Math.min(left, b.dueAmount));
        const dueAfter = r2(b.dueAmount - cleared);
        // Only if the bill still has the due we read, so two repayments at once can't both clear it.
        const res = await Invoice.updateOne(
            { _id: b._id, dueAmount: b.dueAmount },
            { $set: { dueAmount: dueAfter, status: dueAfter <= 0 ? 'paid' : 'partial' } }
        );
        if (!res.modifiedCount) continue;
        left = r2(left - cleared);
        out.push({ invoiceId: b._id, invoiceNo: b.invoiceNo, cleared, dueAfter });
    }
    return out;
}

/** "cleared INV/202609/0012, part of INV/202609/0015" — for the ledger note. */
export const settledNote = (s: SettledBill[]) =>
    s.length ? `cleared ${s.map((x) => (x.dueAfter > 0 ? `part of ${x.invoiceNo}` : x.invoiceNo)).join(', ')}` : '';
