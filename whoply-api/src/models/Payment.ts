/**
 * Payment — a collection received from a dealer against their outstanding balance.
 * Recorded both from a dealer-level collect and an order-level collect, so it doubles
 * as the wholesaler's money-in ledger (see the Payments page + account tally report).
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque' | 'other';

export interface IPayment {
    businessId: Types.ObjectId;
    dealerId: Types.ObjectId;
    dealerName?: string;
    orderId?: Types.ObjectId;
    orderNo?: string;
    amount: number;
    mode: PaymentMode;
    note?: string;
}
export interface IPaymentDocument extends IPayment, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const paymentSchema = new Schema<IPaymentDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        dealerId: { type: Schema.Types.ObjectId, ref: 'Dealer', required: true, index: true },
        dealerName: String,
        orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
        orderNo: String,
        amount: { type: Number, required: true },
        mode: { type: String, enum: ['cash', 'upi', 'bank', 'cheque', 'other'], default: 'cash' },
        note: String,
    },
    { timestamps: true, collection: 'payments' }
);
paymentSchema.index({ businessId: 1, createdAt: -1 });

const Payment: Model<IPaymentDocument> = mongoose.models.Payment || mongoose.model<IPaymentDocument>('Payment', paymentSchema);
export default Payment;
