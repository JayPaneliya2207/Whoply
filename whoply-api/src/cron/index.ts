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
import Notification from '../models/Notification.js';

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

export function initializeCronJobs(): void {
    // 21:00 every day
    cron.schedule('0 21 * * *', () => {
        generateDailySummaries().catch((e) => console.error('[cron] summary failed', e));
    });

    // 09:00 every Monday — weekly supplier-payable reminder
    cron.schedule('0 9 * * 1', () => {
        generatePayableReminders().catch((e) => console.error('[cron] payable reminder failed', e));
    });

    // Generate once shortly after boot so the app has notifications to show.
    setTimeout(() => {
        generateDailySummaries().catch(() => { /* ignore on boot */ });
        generatePayableReminders().catch(() => { /* ignore on boot */ });
    }, 4000);

    console.log('[cron] jobs scheduled');
}
