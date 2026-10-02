/**
 * Support chat — one running conversation per business with the Whoply team
 * (like a WhatsApp chat, not tickets). SupportThread holds the chat's state for
 * the lists and unread badges; SupportMessage holds each message.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export const SUPPORT_TEXT_MAX = 2000;

export interface ISupportThread {
    businessId: Types.ObjectId;
    businessName: string; // copied for the admin list and search
    businessType: string;
    status: 'open' | 'resolved';
    lastText: string; // preview of the newest message
    lastFrom: 'business' | 'admin';
    lastAt: Date;
    unreadAdmin: number; // messages from the business the admin hasn't opened
    unreadBusiness: number; // replies the business hasn't opened
}
export interface ISupportThreadDocument extends ISupportThread, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const supportThreadSchema = new Schema<ISupportThreadDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
        businessName: { type: String, default: '' },
        businessType: { type: String, default: 'retail' },
        status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
        lastText: { type: String, default: '' },
        lastFrom: { type: String, enum: ['business', 'admin'], default: 'business' },
        lastAt: { type: Date, default: Date.now },
        unreadAdmin: { type: Number, default: 0 },
        unreadBusiness: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'supportthreads' }
);
supportThreadSchema.index({ lastAt: -1 }); // the admin's chat list, newest first

export interface ISupportMessage {
    threadId: Types.ObjectId;
    businessId: Types.ObjectId;
    from: 'business' | 'admin';
    senderId: Types.ObjectId;
    senderName: string;
    text: string;
}
export interface ISupportMessageDocument extends ISupportMessage, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const supportMessageSchema = new Schema<ISupportMessageDocument>(
    {
        threadId: { type: Schema.Types.ObjectId, ref: 'SupportThread', required: true },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
        from: { type: String, enum: ['business', 'admin'], required: true },
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        senderName: { type: String, default: '' },
        text: { type: String, required: true, maxlength: SUPPORT_TEXT_MAX },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'supportmessages' }
);
supportMessageSchema.index({ threadId: 1, createdAt: 1 }); // a chat, oldest first; "anything after X"
supportMessageSchema.index({ senderId: 1, createdAt: -1 }); // the per-sender flood check

export const SupportThread: Model<ISupportThreadDocument> = mongoose.models.SupportThread || mongoose.model<ISupportThreadDocument>('SupportThread', supportThreadSchema);
export const SupportMessage: Model<ISupportMessageDocument> = mongoose.models.SupportMessage || mongoose.model<ISupportMessageDocument>('SupportMessage', supportMessageSchema);
