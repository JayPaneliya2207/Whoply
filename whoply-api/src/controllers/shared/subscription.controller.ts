/**
 * The business owner's side of the subscription: their plan, the bills Whoply
 * sent them, how to pay, and "I have paid" (the platform admin confirms it).
 */
import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import { istDayRange } from '../../utils/ist.js';
import Business from '../../models/Business.js';
import Plan from '../../models/Plan.js';
import SubscriptionBill from '../../models/SubscriptionBill.js';
import { getPlatformSettings } from '../../models/PlatformSettings.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** GET /subscription — plan, bills (newest first, cancelled ones left out) and how to pay. */
export const mySubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [business, bills, settings] = await Promise.all([
        Business.findById(businessId).select('name plan planPaidUntil').lean(),
        SubscriptionBill.find({ businessId, status: { $ne: 'cancelled' } })
            .sort({ createdAt: -1 })
            .limit(24)
            .select('billNo planName period periodStart periodEnd amount gstRate gstAmount total dueDate status paidAt paidMode claimedAt claimRef createdAt')
            .lean(),
        getPlatformSettings(),
    ]);
    if (!business) throw AppError.notFound('Business not found');
    const plan = await Plan.findOne({ key: business.plan }).select('key name price period features').lean();
    const today = istDayRange().start;
    const due = bills.filter((b) => b.status === 'due');
    sendSuccess(res, {
        plan: plan || { key: business.plan, name: business.plan, price: 0, period: 'month', features: [] },
        paidUntil: business.planPaidUntil || null,
        bills: bills.map((b) => ({ ...b, overdue: b.status === 'due' && b.dueDate < today })),
        due: { count: due.length, total: Math.round(due.reduce((s, b) => s + b.total, 0) * 100) / 100, overdue: due.some((b) => b.dueDate < today) },
        // Only what an owner needs to pay and to ask for help — never the reminder rules or templates.
        payTo: { company: settings.company.name, gstin: settings.company.gstin, address: settings.company.address, upiId: settings.billing.upiId, bank: settings.billing.bank },
        support: settings.support,
    });
});

/** POST /subscription/bills/:id/claim { ref } — "I have paid": flags the bill for the admin, who confirms it. */
export const claimPaid = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const bill = await SubscriptionBill.findOneAndUpdate(
        { _id: req.params.id, businessId, status: 'due' },
        { $set: { claimedAt: new Date(), claimRef: String(req.body?.ref || '').trim().slice(0, 60) } },
        { new: true }
    ).select('billNo status claimedAt claimRef');
    if (!bill) throw AppError.notFound('Bill not found, or it is already paid');
    sendSuccess(res, bill, 'Thank you — we will confirm your payment shortly');
});
