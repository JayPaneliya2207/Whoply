/**
 * PushSubscription — one browser / installed app that agreed to get phone
 * notifications (Web Push). The browser hands us an address at its push
 * service plus two keys; a message sent there shows up on that device even
 * when Whoply is closed. One login can have several (phone, tablet, counter PC).
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IPushSubscription {
    userId: Types.ObjectId;
    businessId?: Types.ObjectId;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
}
export interface IPushSubscriptionDocument extends IPushSubscription, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
        endpoint: { type: String, required: true, unique: true },
        keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
        userAgent: { type: String, maxlength: 200 },
    },
    { timestamps: true, collection: 'pushsubscriptions' }
);

const PushSubscription: Model<IPushSubscriptionDocument> = mongoose.models.PushSubscription || mongoose.model<IPushSubscriptionDocument>('PushSubscription', pushSubscriptionSchema);
export default PushSubscription;
