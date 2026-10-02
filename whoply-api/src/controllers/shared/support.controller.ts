/**
 * Support chat — the business side (owner and manager): read the chat with the
 * Whoply team, send a message, and the unread count for the menu badge.
 */
import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Notification from '../../models/Notification.js';
import { SupportThread } from '../../models/Support.js';
import { getPlatformSettings } from '../../models/PlatformSettings.js';
import { threadFor, postMessage, messagesOf } from '../../services/support.service.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** GET /support?after=<ISO time> — the chat (or just what's new since `after`); opening it clears the unread count. */
export const myChat = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const thread = await SupportThread.findOne({ businessId }).select('status unreadBusiness').lean();
    const [messages, settings] = await Promise.all([thread ? messagesOf(thread._id, req.query.after) : [], getPlatformSettings()]);
    if (thread?.unreadBusiness) {
        await Promise.all([
            SupportThread.updateOne({ _id: thread._id }, { $set: { unreadBusiness: 0 } }),
            Notification.updateMany({ businessId, type: 'support', isRead: false }, { $set: { isRead: true } }),
        ]);
    }
    sendSuccess(res, { status: thread?.status || 'open', messages, support: settings.support });
});

/** POST /support/messages { text } */
export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const thread = await threadFor(businessOf(req));
    const message = await postMessage(thread, 'business', req.user!, req.body?.text);
    sendCreated(res, { _id: message._id, from: message.from, senderName: message.senderName, text: message.text, createdAt: message.createdAt }, 'Sent');
});

/** GET /support/unread — for the badge; cheap enough to poll. */
export const unreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const thread = await SupportThread.findOne({ businessId: businessOf(req) }).select('unreadBusiness').lean();
    sendSuccess(res, { unread: thread?.unreadBusiness || 0 });
});
