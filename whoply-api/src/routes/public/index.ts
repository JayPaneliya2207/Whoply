import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import Plan from '../../models/Plan.js';

const router = Router();

/** GET /api/public/plans — active subscription plans for the marketing site */
router.get(
    '/plans',
    asyncHandler(async (_req, res) => {
        const plans = await Plan.find({ isActive: true }).sort({ order: 1, price: 1 }).lean();
        sendSuccess(res, plans.map((p) => ({ key: p.key, name: p.name, price: p.price, period: p.period, features: p.features, highlight: p.highlight })));
    })
);

/** GET /api/public/stats — headline numbers for the marketing landing page */
router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
        sendSuccess(res, {
            shopkeepers: '12,000+',
            wholesalers: '1,800+',
            gstInvoices: '4.2M',
            statesCovered: 22,
        });
    })
);

/** GET /api/public/features — feature cards for the landing page */
router.get(
    '/features',
    asyncHandler(async (_req, res) => {
        sendSuccess(res, [
            { icon: 'package', title: 'Smart Inventory', desc: 'Low-stock & expiry alerts, fast/slow movers.' },
            { icon: 'receipt', title: 'GST Billing (POS)', desc: 'Fast, GST-ready invoices in seconds.' },
            { icon: 'wallet', title: 'Udhar Management', desc: 'Track credit with automatic WhatsApp reminders.' },
            { icon: 'truck', title: 'Dispatch & Delivery', desc: 'Bulk orders, warehouse and delivery tracking.' },
            { icon: 'bar-chart', title: 'Business Insights', desc: 'Sales, profit and best-sellers at a glance.' },
            { icon: 'users', title: 'Multi-role Access', desc: 'Owner, cashier, warehouse and sales staff.' },
        ]);
    })
);

export default router;
