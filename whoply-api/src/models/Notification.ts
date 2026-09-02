import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface INotification {
    businessId: Types.ObjectId;
    userId?: Types.ObjectId;
    title: string;
    body: string;
    type: 'low_stock' | 'expiry' | 'udhar' | 'summary' | 'order' | 'payable' | 'general';
    isRead: boolean;
}
export interface INotificationDocument extends INotification, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
        title: { type: String, required: true },
        body: { type: String, required: true },
        type: {
            type: String,
            enum: ['low_stock', 'expiry', 'udhar', 'summary', 'order', 'payable', 'general'],
            default: 'general',
        },
        isRead: { type: Boolean, default: false, index: true },
    },
    { timestamps: true, collection: 'notifications' }
);

// Listing is always business-scoped + newest-first; unread counting adds isRead.
notificationSchema.index({ businessId: 1, createdAt: -1 });
notificationSchema.index({ businessId: 1, isRead: 1, createdAt: -1 });
// Cron de-dup lookups: "has a notification of this type been sent recently?"
notificationSchema.index({ businessId: 1, type: 1, createdAt: -1 });

const Notification: Model<INotificationDocument> =
    mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', notificationSchema);
export default Notification;
