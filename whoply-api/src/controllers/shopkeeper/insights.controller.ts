import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import { reorderSuggestions } from '../../services/ai.service.js';
import Notification from '../../models/Notification.js';
import type { AuthRequest } from '../../interfaces/index.js';

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
    const items = await Notification.find({ businessId }).sort({ createdAt: -1 }).limit(30).lean();
    const unread = await Notification.countDocuments({ businessId, isRead: false });
    sendSuccess(res, { unread, items });
});

/** POST /notifications/read-all */
export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    await Notification.updateMany({ businessId, isRead: false }, { isRead: true });
    sendSuccess(res, { ok: true });
});
