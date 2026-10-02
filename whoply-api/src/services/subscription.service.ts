/**
 * Subscription billing: make a bill for a business's plan period, remind the
 * owner (in the app; the admin sends the WhatsApp message with one tap on a
 * wa.me link — there is no WhatsApp API account yet), and the daily job.
 */
import type { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { istParts, istMidnight, istDayRange, istYm, istDmy } from '../utils/ist.js';
import Business, { type IBusinessDocument } from '../models/Business.js';
import User from '../models/User.js';
import Plan, { type IPlan } from '../models/Plan.js';
import Notification from '../models/Notification.js';
import { nextSequence } from '../models/Counter.js';
import SubscriptionBill, { type ISubscriptionBillDocument } from '../models/SubscriptionBill.js';
import { getPlatformSettings, type IPlatformSettings } from '../models/PlatformSettings.js';

const r2 = (n: number) => Math.round((+n || 0) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;
const money = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const longDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** "1 Oct 2026 – 31 Oct 2026" (the stored end is the next period's first day). */
export const periodLabel = (start: Date, end: Date) => `${longDate(start)} – ${longDate(new Date(+end - DAY))}`;

/** The bill or reminder message, from the admin's template. Unknown {words} are left as typed. */
export function billText(kind: 'bill' | 'reminder', bill: Pick<ISubscriptionBillDocument, 'billNo' | 'businessName' | 'ownerName' | 'planName' | 'total' | 'periodStart' | 'periodEnd' | 'dueDate'>, settings: IPlatformSettings): string {
    const values: Record<string, string> = {
        owner: bill.ownerName || 'there',
        business: bill.businessName,
        plan: bill.planName,
        billNo: bill.billNo,
        amount: money(bill.total),
        period: periodLabel(bill.periodStart, bill.periodEnd),
        dueDate: longDate(bill.dueDate),
    };
    let text = (settings.templates[kind] || '').replace(/\{(\w+)\}/g, (m, k) => values[k] ?? m);
    if (settings.billing.upiId) text += `\nPay by UPI: ${settings.billing.upiId}`;
    return text.trim();
}

interface BillInput {
    business: Pick<IBusinessDocument, '_id' | 'name' | 'plan'>;
    periods?: number; // how many plan periods (months for a monthly plan, years for a yearly one)
    periodStart?: Date;
    amount?: number; // before GST; default plan price × periods
    note?: string;
    createdBy?: Types.ObjectId;
    notify?: boolean;
    settings?: IPlatformSettings;
    plan?: IPlan | null;
}

/**
 * Bill a business for its next plan period. The period starts where the last
 * bill ended (or today, if that has passed); two live bills never overlap.
 * GST is added only when the company GSTIN is filled in Settings.
 */
export async function createBill(input: BillInput): Promise<ISubscriptionBillDocument> {
    const { business } = input;
    const settings = input.settings ?? (await getPlatformSettings());
    const plan = input.plan ?? (await Plan.findOne({ key: business.plan }).lean());
    if (!plan) throw AppError.badRequest(`This business is on plan "${business.plan}", which no longer exists`);

    const periods = Math.round(Number(input.periods ?? 1));
    if (!(periods >= 1 && periods <= 36)) throw AppError.badRequest('Periods must be between 1 and 36');
    const amount = r2(input.amount ?? plan.price * periods);
    if (!(amount > 0)) throw AppError.badRequest(`The ${plan.name} plan is free — enter an amount to bill anyway`);
    if (amount > 10_000_000) throw AppError.badRequest('Amount is too large');

    const today = istDayRange().start;
    let start = input.periodStart;
    if (!start) {
        const last = await SubscriptionBill.findOne({ businessId: business._id, status: { $ne: 'cancelled' } }).sort({ periodEnd: -1 }).select('periodEnd').lean();
        start = last && last.periodEnd > today ? last.periodEnd : today;
    }
    const { y, m, day } = istParts(start);
    start = istMidnight(y, m, day);
    const end = istMidnight(y, m + periods * (plan.period === 'year' ? 12 : 1), day);

    const clash = await SubscriptionBill.findOne({ businessId: business._id, status: { $ne: 'cancelled' }, periodStart: { $lt: end }, periodEnd: { $gt: start } }).select('billNo').lean();
    if (clash) throw AppError.conflict(`Bill ${clash.billNo} already covers this period`);

    const gstRate = settings.company.gstin ? settings.billing.gstRate : 0;
    const gstAmount = r2((amount * gstRate) / 100);
    const owner = await User.findOne({ businessId: business._id, role: 'owner' }).select('name mobile countryCode').lean();
    const seq = await nextSequence(`subbill:${istYm()}`);

    const bill = await SubscriptionBill.create({
        billNo: `SUB/${istYm()}/${String(seq).padStart(4, '0')}`,
        businessId: business._id,
        businessName: business.name,
        ownerName: owner?.name || '',
        ownerMobile: owner?.mobile || '',
        ownerCountryCode: owner?.countryCode || '+91',
        planKey: plan.key,
        planName: plan.name,
        period: plan.period,
        periodStart: start,
        periodEnd: end,
        amount,
        gstRate,
        gstAmount,
        total: r2(amount + gstAmount),
        dueDate: new Date(+today + settings.billing.dueDays * DAY),
        note: input.note ? String(input.note).trim().slice(0, 300) : undefined,
        createdBy: input.createdBy,
    });
    if (input.notify !== false) {
        await Notification.create({
            businessId: business._id,
            title: '🧾 New subscription bill',
            body: `${plan.name} plan · ₹${money(bill.total)} for ${periodLabel(start, end)}. Due ${istDmy(bill.dueDate)}. Tap to view and pay.`,
            type: 'subscription',
        });
    }
    return bill;
}

/** In-app reminder for a due bill; counts it on the bill. Returns the updated bill, or null if it is no longer due. */
export async function remindBill(billId: string | Types.ObjectId): Promise<ISubscriptionBillDocument | null> {
    const bill = await SubscriptionBill.findOneAndUpdate({ _id: billId, status: 'due' }, { $set: { remindedAt: new Date() }, $inc: { reminders: 1 } }, { new: true });
    if (!bill) return null;
    const overdue = bill.dueDate < istDayRange().start;
    await Notification.create({
        businessId: bill.businessId,
        title: overdue ? '⏰ Subscription payment overdue' : '🔔 Subscription payment reminder',
        body: `Bill ${bill.billNo} · ₹${money(bill.total)} ${overdue ? 'was due on' : 'is due on'} ${istDmy(bill.dueDate)}. Tap to pay.`,
        type: 'subscription',
    });
    return bill;
}

/**
 * Bill every active business on a paid plan that has no live bill reaching past
 * today (so nobody is billed twice for the same days).
 */
export async function billEveryone(createdBy?: Types.ObjectId): Promise<{ created: number; skipped: number }> {
    const settings = await getPlatformSettings();
    const plans = await Plan.find({ price: { $gt: 0 } }).lean();
    const byKey = new Map(plans.map((p) => [p.key, p]));
    const today = istDayRange().start;
    const [businesses, covered] = await Promise.all([
        Business.find({ isActive: true, plan: { $in: [...byKey.keys()] } }).select('name plan').lean(),
        SubscriptionBill.distinct('businessId', { status: { $ne: 'cancelled' }, periodEnd: { $gt: today } }),
    ]);
    const done = new Set(covered.map(String));
    let created = 0;
    let skipped = 0;
    for (const business of businesses) {
        if (done.has(String(business._id))) { skipped++; continue; }
        try {
            await createBill({ business, plan: byKey.get(business.plan), settings, createdBy });
            created++;
        } catch (e) {
            skipped++; // a clash from a bill made a moment ago, or a bad plan — the others still get theirs
            if (!(e instanceof AppError)) console.error('[subscription] bill failed for', business.name, e);
        }
    }
    return { created, skipped };
}

/**
 * Daily job: auto-bill (when switched on in Settings) and remind owners —
 * a few days before the due date, on the due date, and every few days once
 * overdue. At most one reminder per bill per day.
 */
export async function runSubscriptionReminders(): Promise<number> {
    const settings = await getPlatformSettings();
    if (settings.billing.autoBill) {
        const r = await billEveryone();
        if (r.created) console.log(`[cron] auto-billed ${r.created} business(es)`);
    }
    const today = istDayRange().start;
    const bills = await SubscriptionBill.find({ status: 'due', $or: [{ remindedAt: { $exists: false } }, { remindedAt: null }, { remindedAt: { $lt: today } }] }).select('dueDate createdAt').lean();
    let sent = 0;
    for (const b of bills) {
        const days = Math.round((+b.dueDate - +today) / DAY);
        const hit = days === settings.billing.remindDaysBefore || days === 0 || (days < 0 && -days % settings.billing.remindOverdueEvery === 0);
        if (!hit || b.createdAt >= today) continue; // the bill itself was today's message
        if (await remindBill(b._id)) sent++;
    }
    if (sent) console.log(`[cron] sent ${sent} subscription reminders`);
    return sent;
}
