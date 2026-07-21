/**
 * Visit — a sales rep's field visit to a dealer (route/visit tracking).
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IVisit {
    businessId: Types.ObjectId;
    salesRepId: Types.ObjectId;
    salesRepName?: string;
    dealerId: Types.ObjectId;
    dealerName?: string;
    outcome: 'order' | 'no_order' | 'follow_up';
    orderId?: Types.ObjectId;
    note?: string;
    visitedAt: Date;
}
export interface IVisitDocument extends IVisit, Document {
    _id: Types.ObjectId;
}

const visitSchema = new Schema<IVisitDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        salesRepId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        salesRepName: String,
        dealerId: { type: Schema.Types.ObjectId, ref: 'Dealer', required: true },
        dealerName: String,
        outcome: { type: String, enum: ['order', 'no_order', 'follow_up'], default: 'no_order' },
        orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
        note: String,
        visitedAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true, collection: 'visits' }
);

const Visit: Model<IVisitDocument> = mongoose.models.Visit || mongoose.model<IVisitDocument>('Visit', visitSchema);
export default Visit;
