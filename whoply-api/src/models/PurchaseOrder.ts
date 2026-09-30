import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IPurchaseItem {
    productId: Types.ObjectId;
    name: string;
    hsn?: string;
    unit?: string;
    quantity: number;
    costPrice: number; // as typed: before GST, or including it when the order's pricesIncludeGst is on
    gstRate?: number; // % — from the product (absent on orders made before GST on purchases)
    taxableValue?: number; // line value before GST
    gstAmount?: number;
    lineTotal: number; // what the line costs, GST included
}

export interface IPurchaseOrder {
    businessId: Types.ObjectId;
    poNo: string;
    supplierId: Types.ObjectId;
    supplierName?: string;
    /** The supplier's GSTIN when the order was made — input tax credit needs a registered supplier. */
    supplierGstin?: string;
    /** The supplier's own bill (tax invoice) number and date — for matching with GSTR-2B. */
    supplierInvoiceNo?: string;
    supplierInvoiceDate?: Date;
    items: IPurchaseItem[];
    pricesIncludeGst?: boolean;
    subtotal?: number; // Σ taxable value (before GST)
    totalGst?: number;
    interState?: boolean; // supplier in another state → IGST, else CGST + SGST
    total: number; // GST included — what the business owes the supplier
    paidAmount: number;
    dueAmount: number;
    status: 'pending' | 'received' | 'cancelled';
    receivedAt?: Date;
}
export interface IPurchaseOrderDocument extends IPurchaseOrder, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        hsn: String,
        unit: String,
        quantity: { type: Number, required: true },
        costPrice: { type: Number, required: true },
        gstRate: Number,
        taxableValue: Number,
        gstAmount: Number,
        lineTotal: { type: Number, required: true },
    },
    { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrderDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        poNo: { type: String, required: true },
        supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
        supplierName: String,
        supplierGstin: String,
        supplierInvoiceNo: String,
        supplierInvoiceDate: Date,
        items: { type: [purchaseItemSchema], default: [] },
        pricesIncludeGst: { type: Boolean, default: false },
        subtotal: Number,
        totalGst: Number,
        interState: Boolean,
        total: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'received', 'cancelled'], default: 'pending', index: true },
        receivedAt: Date,
    },
    { timestamps: true, collection: 'purchase_orders' }
);
purchaseOrderSchema.index({ businessId: 1, poNo: 1 }, { unique: true });
// GST report: received orders in a month (input tax credit)
purchaseOrderSchema.index({ businessId: 1, status: 1, receivedAt: 1 });

const PurchaseOrder: Model<IPurchaseOrderDocument> =
    mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrderDocument>('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
