/**
 * Scheduled jobs: nightly business summary, weekly supplier-payable reminder, and
 * daily udhar/dealer payment reminders.
 *
 * These are written **set-based**: one grouped aggregate across all tenants rather
 * than a query per business, and one bulk write instead of a save() per row. The
 * earlier per-business loop cost ~3 queries + N document writes per tenant, which
 * at a few thousand tenants ran for tens of minutes and overlapped the next run.
 *
 * Every job runs under a JobLock lease so exactly one API instance executes it —
 * without that, horizontal scaling duplicates every notification (and every real
 * WhatsApp message once the provider is wired).
 */
import cron from 'node-cron';
import { Types } from 'mongoose';
import Business from '../models/Business.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';
import Dealer from '../models/Dealer.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import { withJobLock } from '../models/JobLock.js';
import { sendWhatsApp } from '../services/messaging.service.js';

const todayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const inr = (n: number) => Math.round(n).toLocaleString('en-IN');
const idStr = (v: unknown) => String(v);

/** Nightly per-business sales + low-stock digest. 4 queries + 1 bulk insert, total. */
export async function generateDailySummaries(): Promise<number> {
    const { start, end } = todayRange();

    const [actives, salesAgg, lowAgg, alreadySent] = await Promise.all([
        Business.find({ isActive: true }).select('_id').lean(),
        Invoice.aggregate([
            { $match: { createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: '$businessId', sales: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        ]),
        Product.aggregate([
            { $match: { isActive: true, isLowStock: true } },
            { $group: { _id: '$businessId', count: { $sum: 1 } } },
        ]),
        Notification.distinct('businessId', { type: 'summary', createdAt: { $gte: start, $lt: end } }),
    ]);

    const salesBy = new Map(salesAgg.map((r) => [idStr(r._id), r]));
    const lowBy = new Map(lowAgg.map((r) => [idStr(r._id), r.count as number]));
    const sent = new Set(alreadySent.map(idStr));

    const docs = actives
        .filter((b) => !sent.has(idStr(b._id)))
        .map((b) => {
            const s = salesBy.get(idStr(b._id));
            const low = lowBy.get(idStr(b._id)) || 0;
            return {
                businessId: b._id,
                title: '📊 Today’s business summary',
                body: `${s?.count || 0} bills · ₹${inr(s?.sales || 0)} in sales. ${low} product(s) low on stock.`,
                type: 'summary' as const,
            };
        });

    if (docs.length) await Notification.insertMany(docs, { ordered: false });
    if (docs.length) console.log(`[cron] generated ${docs.length} daily summaries`);
    return docs.length;
}

/** Weekly "you owe your suppliers" nudge. 3 queries + 1 bulk insert, total. */
export async function generatePayableReminders(): Promise<number> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [actives, owedAgg, alreadySent] = await Promise.all([
        Business.find({ isActive: true }).select('_id').lean(),
        Supplier.aggregate([
            { $match: { isActive: true, payableBalance: { $gt: 0 } } },
            { $group: { _id: '$businessId', total: { $sum: '$payableBalance' }, count: { $sum: 1 } } },
        ]),
        Notification.distinct('businessId', { type: 'payable', createdAt: { $gte: weekAgo } }),
    ]);

    const activeIds = new Set(actives.map((b) => idStr(b._id)));
    const sent = new Set(alreadySent.map(idStr));

    const docs = owedAgg
        .filter((r) => activeIds.has(idStr(r._id)) && !sent.has(idStr(r._id)))
        .map((r) => ({
            businessId: r._id,
            title: '💸 Supplier payments pending',
            body: `You owe ₹${inr(r.total)} to ${r.count} supplier(s). Tap to review and clear.`,
            type: 'payable' as const,
        }));

    if (docs.length) await Notification.insertMany(docs, { ordered: false });
    if (docs.length) console.log(`[cron] generated ${docs.length} payable reminders`);
    return docs.length;
}

/**
 * Auto payment-reminders to udhar customers (retail) and dealers with open dues
 * (wholesale), throttled per business by `settings.udharReminderDays`.
 *
 * Businesses are bucketed by their reminder interval, so we issue one query per
 * *distinct interval* (usually just the default) instead of one per business.
 */
export async function generateUdharReminders(): Promise<number> {
    const businesses = await Business.find({
        isActive: true,
        'settings.enableUdharReminders': { $ne: false },
    })
        .select('_id name type settings.udharReminderDays')
        .lean();
    if (!businesses.length) return 0;

    const now = Date.now();
    const cutoffFor = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);
    const daysOf = (b: any) => Math.max(1, Number(b.settings?.udharReminderDays) || 7);
    const nameOf = new Map(businesses.map((b) => [idStr(b._id), b.name]));

    // Bucket businesses by interval so each bucket is a single query.
    const retailBuckets = new Map<number, Types.ObjectId[]>();
    const wholesaleBuckets = new Map<number, Types.ObjectId[]>();
    for (const b of businesses) {
        const bucket = b.type === 'wholesale' ? wholesaleBuckets : retailBuckets;
        const key = daysOf(b);
        if (!bucket.has(key)) bucket.set(key, []);
        bucket.get(key)!.push(b._id as Types.ObjectId);
    }

    const notifications: any[] = [];
    const customerStamps: any[] = [];
    const dealerStamps: any[] = [];
    const whatsapps: { to: string; msg: string }[] = [];

    const queue = (businessId: any, name: string, mobile: string | undefined, country: string | undefined, amount: number) => {
        const amt = inr(amount);
        notifications.push({
            businessId,
            title: '💰 Payment reminder sent',
            body: `${name} has ₹${amt} pending. A reminder was sent${mobile ? ` to ${mobile}` : ''}.`,
            type: 'udhar' as const,
        });
        if (mobile) {
            whatsapps.push({
                to: `${country || '+91'}${mobile}`,
                msg: `Hi ${name}, this is a gentle reminder from ${nameOf.get(idStr(businessId))}: ₹${amt} is pending on your account. Kindly clear it at your convenience. Thank you! 🙏`,
            });
        }
    };

    // ---- Retail: customers carrying udhar ----
    for (const [days, ids] of retailBuckets) {
        const cutoff = cutoffFor(days);
        const due = await Customer.find({
            businessId: { $in: ids },
            isActive: true,
            creditBalance: { $gt: 0 },
            $or: [{ lastUdharReminderAt: { $exists: false } }, { lastUdharReminderAt: null }, { lastUdharReminderAt: { $lte: cutoff } }],
        })
            .select('_id businessId name mobile countryCode creditBalance')
            .lean();

        for (const c of due) {
            queue(c.businessId, c.name, c.mobile, c.countryCode, c.creditBalance);
            customerStamps.push({ updateOne: { filter: { _id: c._id }, update: { $set: { lastUdharReminderAt: new Date() } } } });
        }
    }

    // ---- Wholesale: dealers with live order dues ----
    for (const [days, ids] of wholesaleBuckets) {
        const cutoff = cutoffFor(days);
        // One aggregate for every dealer due across this whole bucket.
        const dues = await Order.aggregate([
            { $match: { businessId: { $in: ids }, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } } },
            { $group: { _id: '$dealerId', due: { $sum: '$dueAmount' } } },
        ]);
        if (!dues.length) continue;
        const dueBy = new Map(dues.map((r) => [idStr(r._id), r.due as number]));

        const dealers = await Dealer.find({
            businessId: { $in: ids },
            isActive: true,
            _id: { $in: dues.map((r) => r._id) },
            $or: [{ lastReminderAt: { $exists: false } }, { lastReminderAt: null }, { lastReminderAt: { $lte: cutoff } }],
        })
            .select('_id businessId name mobile countryCode')
            .lean();

        for (const dl of dealers) {
            queue(dl.businessId, dl.name, dl.mobile, dl.countryCode, dueBy.get(idStr(dl._id)) || 0);
            dealerStamps.push({ updateOne: { filter: { _id: dl._id }, update: { $set: { lastReminderAt: new Date() } } } });
        }
    }

    if (!notifications.length) return 0;

    // Bulk everything: 1 insert + up to 2 bulk writes, regardless of tenant count.
    await Notification.insertMany(notifications, { ordered: false });
    if (customerStamps.length) await Customer.bulkWrite(customerStamps);
    if (dealerStamps.length) await Dealer.bulkWrite(dealerStamps);

    // Outbound channel is a stub today. When a real provider is wired this must move
    // to a queue with retries — a failed send here must not lose the whole batch.
    for (const w of whatsapps) sendWhatsApp(w.to, w.msg);

    console.log(`[cron] sent ${notifications.length} udhar reminders`);
    return notifications.length;
}

/** Wrap a job so only one instance runs it, and a failure never crashes the process. */
const guarded = (key: string, ttlMs: number, fn: () => Promise<number>) => () => {
    withJobLock(key, ttlMs, fn).catch((e) => console.error(`[cron] ${key} failed`, e));
};

export function initializeCronJobs(): void {
    // 21:00 daily — business summary
    cron.schedule('0 21 * * *', guarded('daily-summaries', 15 * 60_000, generateDailySummaries));
    // 09:00 Monday — supplier payables
    cron.schedule('0 9 * * 1', guarded('payable-reminders', 15 * 60_000, generatePayableReminders));
    // 10:00 daily — customer/dealer payment reminders
    cron.schedule('0 10 * * *', guarded('udhar-reminders', 30 * 60_000, generateUdharReminders));

    // Dev convenience: seed some notifications shortly after boot so the app isn't empty.
    // Skipped in production — a full re-run on every deploy/restart is wasteful and noisy.
    if (process.env.NODE_ENV !== 'production') {
        setTimeout(() => {
            guarded('daily-summaries', 15 * 60_000, generateDailySummaries)();
            guarded('payable-reminders', 15 * 60_000, generatePayableReminders)();
            guarded('udhar-reminders', 30 * 60_000, generateUdharReminders)();
        }, 4000);
    }

    console.log('[cron] jobs scheduled');
}
