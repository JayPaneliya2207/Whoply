/**
 * Cron jobs. Currently: a nightly business summary that writes a Notification
 * per business (also drives WhatsApp/push later). Runs at 21:00 daily.
 *
 * On boot we also generate today's summary once (guarded) so the demo has
 * notifications to show immediately.
 */
import cron from 'node-cron';
import { Types } from 'mongoose';
import Business from '../models/Business.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';
import Dealer from '../models/Dealer.js';
import Notification from '../models/Notification.js';
import { sendWhatsApp } from '../services/messaging.service.js';
import { duesByDealer } from '../utils/wholesaler.js';

const todayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

export async function generateDailySummaries(): Promise<number> {
    const businesses = await Business.find({ isActive: true }).lean();
    const { start, end } = todayRange();
    let made = 0;

    for (const b of businesses) {
        const bId = new Types.ObjectId(String(b._id));
        const [salesAgg, lowStock] = await Promise.all([
            Invoice.aggregate([
                { $match: { businessId: bId, createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, sales: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
            ]),
            Product.countDocuments({ businessId: bId, isActive: true, $expr: { $lte: ['$currentStock', '$lowStockThreshold'] } }),
        ]);
        const sales = salesAgg[0]?.sales || 0;
        const count = salesAgg[0]?.count || 0;

        // avoid duplicate summary for the same day
        const already = await Notification.findOne({ businessId: bId, type: 'summary', createdAt: { $gte: start, $lt: end } });
        if (already) continue;

        await Notification.create({
            businessId: bId,
            title: '📊 Today’s business summary',
            body: `${count} bills · ₹${Math.round(sales).toLocaleString('en-IN')} in sales. ${lowStock} product(s) low on stock.`,
            type: 'summary',
        });
        made++;
    }
    if (made) console.log(`[cron] generated ${made} daily summaries`);
    return made;
}

/**
 * Weekly reminder of unpaid supplier bills (payables). One Notification per
 * business that owes money — reminds the shopkeeper to clear pending amounts.
 * De-duped to once per 7 days.
 */
export async function generatePayableReminders(): Promise<number> {
    const businesses = await Business.find({ isActive: true }).lean();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let made = 0;

    for (const b of businesses) {
        const bId = new Types.ObjectId(String(b._id));
        const suppliers = await Supplier.find({ businessId: bId, isActive: true, payableBalance: { $gt: 0 } }).lean();
        if (!suppliers.length) continue;

        const already = await Notification.findOne({ businessId: bId, type: 'payable', createdAt: { $gte: weekAgo } });
        if (already) continue;

        const totalDue = suppliers.reduce((s, sup) => s + (sup.payableBalance || 0), 0);
        await Notification.create({
            businessId: bId,
            title: '💸 Supplier payments pending',
            body: `You owe ₹${Math.round(totalDue).toLocaleString('en-IN')} to ${suppliers.length} supplier(s). Tap to review and clear.`,
            type: 'payable',
        });
        made++;
    }
    if (made) console.log(`[cron] generated ${made} payable reminders`);
    return made;
}

/**
 * Auto payment-reminders to udhar (credit) customers. For each active business that
 * has `settings.enableUdharReminders` on, every customer with an outstanding balance
 * is reminded at most once per `settings.udharReminderDays` (default 7). We write an
 * in-app Notification and fire the WhatsApp channel (a stub today — logs only), then
 * stamp `lastUdharReminderAt` so the next run respects the configured interval.
 */
export async function generateUdharReminders(): Promise<number> {
    const businesses = await Business.find({ isActive: true }).lean();
    const now = Date.now();
    let made = 0;

    for (const b of businesses) {
        if (b.settings?.enableUdharReminders === false) continue;
        const bId = new Types.ObjectId(String(b._id));
        const days = Math.max(1, Number(b.settings?.udharReminderDays) || 7);
        const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
        const overdue = (d?: Date | null) => !d || d.getTime() <= cutoff.getTime();
        const remind = (name: string, mobile: string | undefined, country: string | undefined, amount: number) => {
            const amt = Math.round(amount).toLocaleString('en-IN');
            const notif = Notification.create({
                businessId: bId,
                title: '💰 Payment reminder sent',
                body: `${name} has ₹${amt} pending. A reminder was sent${mobile ? ` to ${mobile}` : ''}.`,
                type: 'udhar',
            });
            if (mobile) {
                sendWhatsApp(`${country || '+91'}${mobile}`,
                    `Hi ${name}, this is a gentle reminder from ${b.name}: ₹${amt} is pending on your account. Kindly clear it at your convenience. Thank you! 🙏`);
            }
            return notif;
        };

        if (b.type === 'wholesale') {
            // Dealers' outstanding is derived from live order dues (source of truth).
            const dues = await duesByDealer(bId);
            const dueMap = new Map(dues.filter((d) => d.due > 0).map((d) => [String(d._id), d.due]));
            if (!dueMap.size) continue;
            const dealers = await Dealer.find({ businessId: bId, isActive: true, _id: { $in: [...dueMap.keys()].map((id) => new Types.ObjectId(id)) } });
            for (const d of dealers) {
                if (!overdue(d.lastReminderAt)) continue;
                await remind(d.name, d.mobile, d.countryCode, dueMap.get(String(d._id)) || 0);
                d.lastReminderAt = new Date();
                await d.save();
                made++;
            }
        } else {
            const due = await Customer.find({
                businessId: bId,
                isActive: true,
                creditBalance: { $gt: 0 },
                $or: [{ lastUdharReminderAt: { $exists: false } }, { lastUdharReminderAt: null }, { lastUdharReminderAt: { $lte: cutoff } }],
            });
            for (const c of due) {
                await remind(c.name, c.mobile, c.countryCode, c.creditBalance);
                c.lastUdharReminderAt = new Date();
                await c.save();
                made++;
            }
        }
    }
    if (made) console.log(`[cron] sent ${made} udhar reminders`);
    return made;
}

export function initializeCronJobs(): void {
    // 21:00 every day
    cron.schedule('0 21 * * *', () => {
        generateDailySummaries().catch((e) => console.error('[cron] summary failed', e));
    });

    // 09:00 every Monday — weekly supplier-payable reminder
    cron.schedule('0 9 * * 1', () => {
        generatePayableReminders().catch((e) => console.error('[cron] payable reminder failed', e));
    });

    // 10:00 every day — auto payment-reminders to due customers (throttled per business setting)
    cron.schedule('0 10 * * *', () => {
        generateUdharReminders().catch((e) => console.error('[cron] udhar reminder failed', e));
    });

    // Generate once shortly after boot so the app has notifications to show.
    setTimeout(() => {
        generateDailySummaries().catch(() => { /* ignore on boot */ });
        generatePayableReminders().catch(() => { /* ignore on boot */ });
        generateUdharReminders().catch(() => { /* ignore on boot */ });
    }, 4000);

    console.log('[cron] jobs scheduled');
}
