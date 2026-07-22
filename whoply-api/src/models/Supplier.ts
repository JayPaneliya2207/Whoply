import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface ISupplier {
    businessId: Types.ObjectId;
    name: string;
    mobile?: string;
    countryCode?: string;
    gstin?: string;
    address?: string;
    payableBalance: number; // amount the business owes the supplier
    isActive: boolean;
}
export interface ISupplierDocument extends ISupplier, Document {
    _id: Types.ObjectId;
}

const supplierSchema = new Schema<ISupplierDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        name: { type: String, required: true, trim: true },
        mobile: String,
        countryCode: { type: String, default: '+91' },
        gstin: { type: String, uppercase: true },
        address: String,
        payableBalance: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'suppliers' }
);

const Supplier: Model<ISupplierDocument> =
    mongoose.models.Supplier || mongoose.model<ISupplierDocument>('Supplier', supplierSchema);
export default Supplier;
