/**
 * Support chat — the platform admin's side: every business's chat, newest
 * first, with unread counts; open one, reply, mark it solved, or start one.
 */
import type { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { containsText } from '../../utils/search.js';
import User from '../../models/User.js';
import { SupportThread } from '../../models/Support.js';
import { threadFor, postMessage, messagesOf } from '../../services/support.service.js';
import type { AuthRequest } from '../../interfaces/index.js';

const summary = async () => {
    const [agg] = await SupportThread.aggregate([{ $group: { _id: null, unread: { $sum: '$unreadAdmin' }, waiting: { $sum: { $cond: [{ $gt: ['$unreadAdmin', 0] }, 1, 0] } }, open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } } } }]);
    return { unread: agg?.unread || 0, waiting: agg?.waiting || 0, open: agg?.open || 0 };
};

/** GET /admin/support/summary — unread messages / chats waiting, for the menu badge. */
export const supportSummary = asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, await summary());
});

/** GET /admin/support/threads?status=open|resolved&search=&page=&limit= */
export const listThreads = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (['open', 'resolved'].includes(String(req.query.status))) filter.status = req.query.status;
    if (req.query.search) filter.businessName = containsText(req.query.search);
    const [items, total, counts] = await Promise.all([
        SupportThread.find(filter).sort({ lastAt: -1 }).skip(skip).limit(limit).lean(),
        SupportThread.countDocuments(filter),
        summary(),
    ]);
    res.json({ success: true, data: { items, meta: meta(total), summary: counts } });
});

const loadThread = async (id: unknown) => {
    if (!Types.ObjectId.isValid(String(id))) throw AppError.notFound('Chat not found');
    const thread = await SupportThread.findById(String(id));
    if (!thread) throw AppError.notFound('Chat not found');
    return thread;
};

/** GET /admin/support/threads/:id?after= — messages; opening the chat clears its unread count. */
export const getThread = asyncHandler(async (req: AuthRequest, res: Response) => {
    const thread = await loadThread(req.params.id);
    const [messages, owner] = await Promise.all([
        messagesOf(thread._id, req.query.after),
        req.query.after ? null : User.findOne({ businessId: thread.businessId, role: 'owner' }).select('name mobile countryCode').lean(),
    ]);
    if (thread.unreadAdmin) await SupportThread.updateOne({ _id: thread._id }, { $set: { unreadAdmin: 0 } });
    sendSuccess(res, { thread: { _id: thread._id, businessId: thread.businessId, businessName: thread.businessName, businessType: thread.businessType, status: thread.status }, owner, messages });
});

/** POST /admin/support/threads/:id/messages { text } — reply; the business gets a notification. */
export const reply = asyncHandler(async (req: AuthRequest, res: Response) => {
    const thread = await loadThread(req.params.id);
    const message = await postMessage(thread, 'admin', req.user!, req.body?.text);
    sendCreated(res, { _id: message._id, from: message.from, senderName: message.senderName, text: message.text, createdAt: message.createdAt }, 'Sent');
});

/** POST /admin/support/threads { businessId, text } — write to a business first. */
export const startThread = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { businessId, text } = req.body;
    if (!businessId || !Types.ObjectId.isValid(String(businessId))) throw AppError.badRequest('Pick a business');
    const thread = await threadFor(String(businessId));
    await postMessage(thread, 'admin', req.user!, text);
    sendCreated(res, { _id: thread._id }, 'Message sent');
});

/** PATCH /admin/support/threads/:id { status: 'resolved' | 'open' } */
export const setThreadStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!['open', 'resolved'].includes(req.body?.status)) throw AppError.badRequest('status must be open or resolved');
    const thread = await loadThread(req.params.id);
    thread.status = req.body.status;
    if (thread.status === 'resolved') thread.unreadAdmin = 0;
    await thread.save();
    sendSuccess(res, { _id: thread._id, status: thread.status }, thread.status === 'resolved' ? 'Marked solved' : 'Chat reopened');
});
