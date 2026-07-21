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

export function initializeCronJobs(): void {
    // 21:00 every day
    cron.schedule('0 21 * * *', () => {
        generateDailySummaries().catch((e) => console.error('[cron] summary failed', e));
    });

    // Generate once shortly after boot so the app has notifications to show.
    setTimeout(() => {
        generateDailySummaries().catch(() => { /* ignore on boot */ });
    }, 4000);

    console.log('[cron] jobs scheduled');
}
