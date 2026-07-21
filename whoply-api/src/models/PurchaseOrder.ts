import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IPurchaseItem {
    productId: Types.ObjectId;
    name: string;
    quantity: number;
    costPrice: number;
    lineTotal: number;
}

export interface IPurchaseOrder {
    businessId: Types.ObjectId;
    poNo: string;
    supplierId: Types.ObjectId;
    supplierName?: string;
    items: IPurchaseItem[];
    total: number;
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
        quantity: { type: Number, required: true },
        costPrice: { type: Number, required: true },
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
        items: { type: [purchaseItemSchema], default: [] },
        total: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'received', 'cancelled'], default: 'pending', index: true },
        receivedAt: Date,
    },
    { timestamps: true, collection: 'purchase_orders' }
);
purchaseOrderSchema.index({ businessId: 1, poNo: 1 }, { unique: true });

const PurchaseOrder: Model<IPurchaseOrderDocument> =
    mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrderDocument>('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
