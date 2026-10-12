import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import { reorderSuggestions } from '../../services/ai.service.js';
import Notification from '../../models/Notification.js';
import type { AuthRequest } from '../../interfaces/index.js';
import { can, type Perm } from '../../utils/permissions.js';

/**
 * Which notification kinds a role may read: the day summary carries sales and
 * profit, "payable" the supplier dues, and so on — a cashier is kept away from
 * those numbers on every other screen, so here too. "general" is for everyone.
 */
const NEEDS: Record<string, Perm[]> = {
    summary: ['profit.view'],
    payable: ['purchases.view'],
    subscription: ['business.edit'],
    support: ['support.chat'],
    udhar: ['customers.view', 'dealers.view'],
    low_stock: ['products.view'],
    expiry: ['products.view'],
    order: ['orders.view'],
};
const kindsFor = (role?: Parameters<typeof can>[0]): any => ({ $in: ['general', ...Object.keys(NEEDS).filter((k) => NEEDS[k].some((p) => can(role, p)))] });

/** GET /ai/reorder — AI reorder suggestions */
export const aiReorder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const suggestions = await reorderSuggestions(businessId);
    sendSuccess(res, {
        generatedAt: new Date().toISOString(),
        critical: suggestions.filter((s) => s.urgency === 'critical').length,
        suggestions,
    });
});

/** GET /notifications */
export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const type = kindsFor(req.user?.role);
    const items = await Notification.find({ businessId, type }).sort({ createdAt: -1 }).limit(30).lean();
    const unread = await Notification.countDocuments({ businessId, type, isRead: false });
    sendSuccess(res, { unread, items });
});

/** POST /notifications/read-all */
export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    await Notification.updateMany({ businessId, type: kindsFor(req.user?.role), isRead: false }, { isRead: true });
    sendSuccess(res, { ok: true });
});

/** POST /notifications/:id/read — mark a single notification read (on open) */
export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    await Notification.updateOne({ _id: req.params.id, businessId, type: kindsFor(req.user?.role) }, { isRead: true });
    sendSuccess(res, { ok: true });
});
