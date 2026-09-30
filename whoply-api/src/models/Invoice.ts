/**
 * Invoice — a POS sale (retail) or a wholesale sale. Holds line items with GST
 * breakup and the payment split (cash/UPI/card/credit).
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IInvoiceItem {
    productId: Types.ObjectId;
    name: string;
    hsn?: string;
    quantity: number;
    unit: string;
    price: number; // per unit (pre-tax)
    gstRate: number;
    gstAmount: number;
    taxableValue?: number; // after bill discount; absent on documents created before it existed
    lineTotal: number; // qty*price + gst
}

/** Summary of how a bill was paid: one mode, 'split' across several, or 'credit' (all udhar). */
export type PaymentMode = 'cash' | 'upi' | 'card' | 'wallet' | 'credit' | 'split';

/** Money received at the counter for a bill, by mode (see utils/payments.ts). */
export interface IInvoicePayment {
    mode: 'cash' | 'upi' | 'card' | 'wallet';
    amount: number;
}

export interface IInvoice {
    businessId: Types.ObjectId;
    invoiceNo: string;
    customerId?: Types.ObjectId;
    customerName?: string;
    customerMobile?: string;
    customerGstin?: string; // captured at sale time for B2B invoices (GSTR-1)
    items: IInvoiceItem[];
    subtotal: number;
    totalGst: number;
    discount: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentMode: PaymentMode;
    /** Absent on bills made before split payment — read paymentMode + paidAmount for those. */
    payments?: IInvoicePayment[];
    status: 'paid' | 'partial' | 'credit';
    whatsappSentAt?: Date; // set when the bill is shared on WhatsApp
    returnsRev?: number; // bumped by every return on this bill — two returns at once can't both pass the "already returned" check
    createdBy?: Types.ObjectId;
}
export interface IInvoiceDocument extends IInvoice, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        hsn: String,
        quantity: { type: Number, required: true },
        unit: { type: String, default: 'pcs' },
        price: { type: Number, required: true },
        gstRate: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        taxableValue: Number, // line value after its share of the bill discount (absent on old docs)
        lineTotal: { type: Number, required: true },
    },
    { _id: false }
);

const invoiceSchema = new Schema<IInvoiceDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        invoiceNo: { type: String, required: true, index: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
        customerName: String,
        customerMobile: String,
        customerGstin: String,
        items: { type: [invoiceItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        totalGst: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        paymentMode: { type: String, enum: ['cash', 'upi', 'card', 'wallet', 'credit', 'split'], default: 'cash' },
        payments: {
            type: [new Schema({ mode: { type: String, enum: ['cash', 'upi', 'card', 'wallet'], required: true }, amount: { type: Number, required: true } }, { _id: false })],
            default: undefined,
        },
        status: { type: String, enum: ['paid', 'partial', 'credit'], default: 'paid', index: true },
        whatsappSentAt: Date,
        returnsRev: { type: Number, default: 0 },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'invoices' }
);
invoiceSchema.index({ businessId: 1, invoiceNo: 1 }, { unique: true });
// Bills list / reports / GST all filter by business and sort newest-first.
invoiceSchema.index({ businessId: 1, createdAt: -1 });
invoiceSchema.index({ businessId: 1, status: 1, createdAt: -1 });
// B2B (GSTR-1) grouping by customer GSTIN within a period.
invoiceSchema.index({ businessId: 1, customerGstin: 1, createdAt: -1 });

const Invoice: Model<IInvoiceDocument> =
    mongoose.models.Invoice || mongoose.model<IInvoiceDocument>('Invoice', invoiceSchema);
export default Invoice;
