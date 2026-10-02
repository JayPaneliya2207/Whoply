/**
 * Support chat rules shared by the business side and the admin side.
 */
import type { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import Business from '../models/Business.js';
import Notification from '../models/Notification.js';
import { SupportThread, SupportMessage, SUPPORT_TEXT_MAX, type ISupportThreadDocument } from '../models/Support.js';

/** At most this many messages a minute from one person — a stuck key or a script can't flood the chat. */
const PER_MINUTE = 20;
const PAGE = 100; // newest messages sent when a chat is opened

/** Trimmed message text, or a 400 that says what's wrong. */
export function cleanText(raw: unknown): string {
    const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
    if (!text) throw AppError.badRequest('Type a message first');
    if (text.length > SUPPORT_TEXT_MAX) throw AppError.badRequest(`Message is too long (${SUPPORT_TEXT_MAX} characters max)`);
    return text;
}

/** The business's chat, made on first use. */
export async function threadFor(businessId: Types.ObjectId | string): Promise<ISupportThreadDocument> {
    const existing = await SupportThread.findOne({ businessId });
    if (existing) return existing;
    const business = await Business.findById(businessId).select('name type').lean();
    if (!business) throw AppError.notFound('Business not found');
    try {
        return await SupportThread.create({ businessId, businessName: business.name, businessType: business.type });
    } catch (e: any) {
        // Two first messages at the same moment: the unique index lets one create it, the other reads it.
        if (e?.code === 11000) return (await SupportThread.findOne({ businessId }))!;
        throw e;
    }
}

interface Sender { _id: Types.ObjectId; name: string }

/** Add a message to a chat and update the chat's preview and unread counts. */
export async function postMessage(thread: ISupportThreadDocument, from: 'business' | 'admin', sender: Sender, rawText: unknown) {
    const text = cleanText(rawText);
    const recent = await SupportMessage.countDocuments({ senderId: sender._id, createdAt: { $gte: new Date(Date.now() - 60_000) } });
    if (recent >= PER_MINUTE) throw AppError.tooManyRequests('You are sending messages too fast — wait a minute');

    const message = await SupportMessage.create({ threadId: thread._id, businessId: thread.businessId, from, senderId: sender._id, senderName: sender.name, text });
    await SupportThread.updateOne(
        { _id: thread._id },
        {
            $set: { lastText: text.slice(0, 140), lastFrom: from, lastAt: message.createdAt, ...(from === 'business' ? { status: 'open' } : {}) },
            $inc: from === 'business' ? { unreadAdmin: 1 } : { unreadBusiness: 1 },
        }
    );
    if (from === 'admin') {
        // One bell notification per burst of replies — not one per message.
        const pending = await Notification.exists({ businessId: thread.businessId, type: 'support', isRead: false });
        if (!pending) await Notification.create({ businessId: thread.businessId, title: '💬 Whoply support replied', body: text.slice(0, 120), type: 'support' });
    }
    return message;
}

/** A chat's messages, oldest first: everything after `after` (a date) or the newest page. */
export async function messagesOf(threadId: Types.ObjectId, after?: unknown) {
    const since = after ? new Date(String(after)) : null;
    if (since && !Number.isNaN(+since)) {
        return SupportMessage.find({ threadId, createdAt: { $gt: since } }).sort({ createdAt: 1 }).limit(PAGE).select('from senderName text createdAt').lean();
    }
    const newest = await SupportMessage.find({ threadId }).sort({ createdAt: -1 }).limit(PAGE).select('from senderName text createdAt').lean();
    return newest.reverse();
}
