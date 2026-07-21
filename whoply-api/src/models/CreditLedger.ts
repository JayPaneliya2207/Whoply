/**
 * CreditLedger — every udhar (credit) event for a customer: a credit sale adds
 * to the balance, a repayment reduces it. Reminders read the outstanding aging.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type LedgerType = 'credit' | 'repayment';

export interface ICreditLedger {
    businessId: Types.ObjectId;
    customerId: Types.ObjectId;
    type: LedgerType;
    amount: number;
    balanceAfter: number;
    refType?: string;
    refId?: Types.ObjectId;
    note?: string;
    reminderSentAt?: Date;
}
export interface ICreditLedgerDocument extends ICreditLedger, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const creditLedgerSchema = new Schema<ICreditLedgerDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
        type: { type: String, enum: ['credit', 'repayment'], required: true },
        amount: { type: Number, required: true },
        balanceAfter: { type: Number, required: true },
        refType: String,
        refId: Schema.Types.ObjectId,
        note: String,
        reminderSentAt: Date,
    },
    { timestamps: true, collection: 'credit_ledger' }
);

const CreditLedger: Model<ICreditLedgerDocument> =
    mongoose.models.CreditLedger || mongoose.model<ICreditLedgerDocument>('CreditLedger', creditLedgerSchema);
export default CreditLedger;
