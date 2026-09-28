import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import Plan from '../../models/Plan.js';
import Business from '../../models/Business.js';
import Invoice from '../../models/Invoice.js';
import Order from '../../models/Order.js';

const router = Router();

interface PublicStats {
    shopkeepers: number;
    wholesalers: number;
    gstInvoices: number;
    statesCovered: number;
    updatedAt: string;
}

/* The stats are unauthenticated and hit several collections, so compute them
   at most once per window rather than on every request. */
const STATS_TTL_MS = 10 * 60 * 1000;
let statsCache: { at: number; data: PublicStats } | null = null;

async function computeStats(): Promise<PublicStats> {
    const [shopkeepers, wholesalers, invoices, orders, states] = await Promise.all([
        Business.countDocuments({ type: 'retail', isActive: true }),
        Business.countDocuments({ type: 'wholesale', isActive: true }),
        Invoice.estimatedDocumentCount(),
        Order.countDocuments({ status: { $ne: 'cancelled' } }),
        Business.distinct('state', { isActive: true }),
    ]);
    // `state` is free text, so "Gujarat" and " gujarat" must count once.
    const statesCovered = new Set(
        (states as unknown[]).map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean)
    ).size;
    return {
        shopkeepers,
        wholesalers,
        gstInvoices: invoices + orders,
        statesCovered,
        updatedAt: new Date().toISOString(),
    };
}

/** GET /api/public/plans — active subscription plans for the marketing site */
router.get(
    '/plans',
    asyncHandler(async (_req, res) => {
        const plans = await Plan.find({ isActive: true }).sort({ order: 1, price: 1 }).lean();
        sendSuccess(res, plans.map((p) => ({ key: p.key, name: p.name, price: p.price, period: p.period, features: p.features, highlight: p.highlight })));
    })
);

/**
 * GET /api/public/stats — real counts from the database (active businesses,
 * GST bills + non-cancelled orders, distinct states), cached for 10 minutes.
 * These are true but small early on: show them publicly only once they're
 * worth showing — invented traction numbers are ASCI-actionable in India
 * (landing-content.md §22).
 */
router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
        if (!statsCache || Date.now() - statsCache.at > STATS_TTL_MS) {
            statsCache = { at: Date.now(), data: await computeStats() };
        }
        sendSuccess(res, statsCache.data);
    })
);

/**
 * GET /api/public/features — capability cards for the landing page. Every line
 * must be something the product does today (landing-content.md §22): no
 * expiry alerts, no automatic WhatsApp sending, no role-restricted views yet.
 */
router.get(
    '/features',
    asyncHandler(async (_req, res) => {
        sendSuccess(res, [
            { icon: 'receipt', title: 'GST Billing (POS)', desc: 'Fast, correct, GST-ready invoices — cash, UPI, card, or split across all three.' },
            { icon: 'package', title: 'Smart Inventory', desc: 'Low stock, fast and slow movers — you find out before it costs you.' },
            { icon: 'wallet', title: 'Udhar & Credit', desc: 'Every customer’s ledger with aging, and a daily list of who to chase.' },
            { icon: 'truck', title: 'Orders & Dispatch', desc: 'Bulk orders, warehouse, dispatch and delivery in one timeline.' },
            { icon: 'bar-chart', title: 'Reports that decide things', desc: 'Today’s sales, real profit, best and worst products, top customers.' },
            { icon: 'users', title: 'Separate staff logins', desc: 'Owner, manager, cashier, warehouse, sales staff — each with their own login.' },
        ]);
    })
);

export default router;
