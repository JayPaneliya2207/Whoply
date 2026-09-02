/**
 * CreditNote — a sales return against an Invoice. Restores stock and either refunds
 * cash or reduces the customer's udhar (credit) balance. Acts as the return document.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import type { IInvoiceItem } from './Invoice.js';

export type RefundMode = 'cash' | 'udhar_adjust';

export interface ICreditNote {
    businessId: Types.ObjectId;
    creditNoteNo: string;
    invoiceId?: Types.ObjectId; // retail return (against an Invoice)
    invoiceNo?: string;
    orderId?: Types.ObjectId; // wholesale return (against an Order)
    orderNo?: string;
    dealerId?: Types.ObjectId;
    cashRefund?: number; // for wholesale: amount owed back to the dealer if they'd overpaid
    customerId?: Types.ObjectId;
    customerName?: string;
    customerMobile?: string;
    customerGstin?: string;
    items: IInvoiceItem[];
    subtotal: number;
    totalGst: number;
    total: number;
    reason?: string;
    refundMode: RefundMode;
    createdBy?: Types.ObjectId;
}
export interface ICreditNoteDocument extends ICreditNote, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const cnItemSchema = new Schema<IInvoiceItem>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        hsn: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: 'pcs' },
        price: { type: Number, required: true },
        gstRate: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        lineTotal: { type: Number, required: true },
    },
    { _id: false }
);

const creditNoteSchema = new Schema<ICreditNoteDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        creditNoteNo: { type: String, required: true, index: true },
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
        invoiceNo: String,
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
        orderNo: String,
        dealerId: { type: Schema.Types.ObjectId, ref: 'Dealer' },
        cashRefund: { type: Number, default: 0 },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
        customerName: String,
        customerMobile: String,
        customerGstin: String,
        items: { type: [cnItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        totalGst: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        reason: String,
        refundMode: { type: String, enum: ['cash', 'udhar_adjust'], default: 'cash' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'credit_notes' }
);
creditNoteSchema.index({ businessId: 1, creditNoteNo: 1 }, { unique: true });
// Returns list sorts newest-first per business.
creditNoteSchema.index({ businessId: 1, createdAt: -1 });

const CreditNote: Model<ICreditNoteDocument> = mongoose.models.CreditNote || mongoose.model<ICreditNoteDocument>('CreditNote', creditNoteSchema);
export default CreditNote;
