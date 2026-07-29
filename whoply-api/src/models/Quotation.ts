/**
 * Quotation — a non-binding price estimate (quote/proforma) that can later be
 * converted into a real Invoice (POS sale). Holds the same line items as an
 * invoice but does NOT touch stock or payments until it is converted.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import type { IInvoiceItem } from './Invoice.js';

export interface IQuotation {
    businessId: Types.ObjectId;
    quoteNo: string;
    dealerId?: Types.ObjectId; // set for wholesale quotes (convert → Order); customer fields hold dealer name/gstin
    customerId?: Types.ObjectId;
    customerName?: string;
    customerMobile?: string;
    customerGstin?: string;
    items: IInvoiceItem[];
    subtotal: number;
    totalGst: number;
    discount: number;
    grandTotal: number;
    status: 'open' | 'converted';
    validUntil?: Date;
    convertedInvoiceId?: Types.ObjectId;
    convertedInvoiceNo?: string;
    createdBy?: Types.ObjectId;
}
export interface IQuotationDocument extends IQuotation, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const quoteItemSchema = new Schema<IInvoiceItem>(
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

const quotationSchema = new Schema<IQuotationDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        quoteNo: { type: String, required: true, index: true },
        dealerId: { type: Schema.Types.ObjectId, ref: 'Dealer' },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
        customerName: String,
        customerMobile: String,
        customerGstin: String,
        items: { type: [quoteItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        totalGst: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        status: { type: String, enum: ['open', 'converted'], default: 'open', index: true },
        validUntil: Date,
        convertedInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
        convertedInvoiceNo: String,
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'quotations' }
);
quotationSchema.index({ businessId: 1, quoteNo: 1 }, { unique: true });

const Quotation: Model<IQuotationDocument> = mongoose.models.Quotation || mongoose.model<IQuotationDocument>('Quotation', quotationSchema);
export default Quotation;
