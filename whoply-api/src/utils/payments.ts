/**
 * How a POS bill was paid at the counter.
 *
 * `payments` lists the money actually received, by mode — one entry for a normal
 * bill, several for a split bill (₹400 cash + ₹600 UPI). Whatever isn't paid
 * becomes udhar (the caller then needs a customer). Clients that predate split
 * payment send `{ paymentMode, paidAmount }`; that is mapped onto the same shape.
 */
import { AppError } from './AppError.js';
import { round2 } from './tax.js';
import type { PaymentMode } from '../models/Invoice.js';

export const COUNTER_MODES = ['cash', 'upi', 'card', 'wallet'] as const;
export type CounterMode = (typeof COUNTER_MODES)[number];
export interface CounterPayment {
    mode: CounterMode;
    amount: number;
}

const isCounterMode = (m: unknown): m is CounterMode => (COUNTER_MODES as readonly unknown[]).includes(m);

export function resolvePayments(body: any, grandTotal: number) {
    let payments: CounterPayment[];
    if (Array.isArray(body.payments)) {
        const byMode = new Map<CounterMode, number>();
        for (const p of body.payments) {
            if (!isCounterMode(p?.mode)) throw AppError.badRequest(`Unknown payment mode "${p?.mode}"`);
            const amount = Number(p.amount);
            if (!Number.isFinite(amount) || amount < 0) throw AppError.badRequest('Payment amounts must be 0 or more');
            if (amount > 0) byMode.set(p.mode, round2((byMode.get(p.mode) || 0) + amount));
        }
        payments = [...byMode].map(([mode, amount]) => ({ mode, amount }));
    } else {
        const mode = body.paymentMode ?? 'cash';
        const asked = mode === 'credit' ? Number(body.paidAmount || 0) : body.paidAmount != null ? Number(body.paidAmount) : grandTotal;
        const amount = round2(Math.min(grandTotal, Math.max(0, asked || 0)));
        // An old "credit" bill with a part payment: that part came in cash.
        payments = amount > 0 ? [{ mode: isCounterMode(mode) ? mode : 'cash', amount }] : [];
    }

    const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (paid > grandTotal + 0.005) {
        throw AppError.badRequest(`Payments add up to ₹${paid}, more than the bill (₹${grandTotal})`);
    }
    const due = round2(grandTotal - paid);
    const status: 'paid' | 'partial' | 'credit' = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'credit';
    const paymentMode: PaymentMode = payments.length > 1 ? 'split' : paid > 0 ? payments[0].mode : 'credit';
    return { payments, paid, due, status, paymentMode };
}
