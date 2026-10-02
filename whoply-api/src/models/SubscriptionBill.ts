/**
 * SubscriptionBill — what a business owes Whoply for its plan, for one period.
 * Made by the platform admin (or the daily job when auto-billing is on), shown
 * to the owner in the app, and marked paid by the admin once the money arrives.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type SubBillStatus = 'due' | 'paid' | 'cancelled';
export const PAID_MODES = ['upi', 'bank', 'cash', 'cheque', 'other'] as const;

export interface ISubscriptionBill {
    billNo: string; // SUB/202610/0001
    businessId: Types.ObjectId;
    // copied at billing time, so the bill reads the same after a rename
    businessName: string;
    ownerName: string;
    ownerMobile: string;
    ownerCountryCode: string;
    planKey: string;
    planName: string;
    period: 'month' | 'year';
    periodStart: Date; // India-time midnight, inclusive
    periodEnd: Date; // India-time midnight, exclusive (the next period's start)
    amount: number; // before GST
    gstRate: number;
    gstAmount: number;
    total: number;
    dueDate: Date;
    status: SubBillStatus;
    paidAt?: Date;
    paidMode?: (typeof PAID_MODES)[number];
    paidRef?: string;
    note?: string;
    // the owner tapped "I have paid" in the app — the admin still confirms
    claimedAt?: Date;
    claimRef?: string;
    remindedAt?: Date;
    reminders: number;
    createdBy?: Types.ObjectId;
}
export interface ISubscriptionBillDocument extends ISubscriptionBill, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const subscriptionBillSchema = new Schema<ISubscriptionBillDocument>(
    {
        billNo: { type: String, required: true, unique: true },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        businessName: { type: String, required: true },
        ownerName: { type: String, default: '' },
        ownerMobile: { type: String, default: '' },
        ownerCountryCode: { type: String, default: '+91' },
        planKey: { type: String, required: true },
        planName: { type: String, required: true },
        period: { type: String, enum: ['month', 'year'], default: 'month' },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        gstRate: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        total: { type: Number, required: true, min: 0 },
        dueDate: { type: Date, required: true },
        status: { type: String, enum: ['due', 'paid', 'cancelled'], default: 'due', index: true },
        paidAt: Date,
        paidMode: { type: String, enum: PAID_MODES },
        paidRef: { type: String, trim: true },
        note: { type: String, trim: true },
        claimedAt: Date,
        claimRef: { type: String, trim: true },
        remindedAt: Date,
        reminders: { type: Number, default: 0 },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'subscriptionbills' }
);

subscriptionBillSchema.index({ businessId: 1, periodStart: -1 });
subscriptionBillSchema.index({ status: 1, dueDate: 1 }); // the admin list and the reminder job
subscriptionBillSchema.index({ status: 1, paidAt: -1 }); // "collected this month"

const SubscriptionBill: Model<ISubscriptionBillDocument> =
    mongoose.models.SubscriptionBill || mongoose.model<ISubscriptionBillDocument>('SubscriptionBill', subscriptionBillSchema);
export default SubscriptionBill;
