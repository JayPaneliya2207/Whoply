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

const Notification: Model<INotificationDocument> =
    mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', notificationSchema);
export default Notification;
