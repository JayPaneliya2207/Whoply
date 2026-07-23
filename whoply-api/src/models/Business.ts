/**
 * Business (tenant) — a shop (retail) or a distributor (wholesale).
 * Every User, Product, Invoice, etc. belongs to a Business.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type BusinessType = 'retail' | 'wholesale';

export interface IBusiness {
    name: string;
    type: BusinessType;
    ownerName: string;
    mobile: string;
    countryCode: string;
    email?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    logo?: string;
    upiId?: string; // shop's UPI VPA for POS collect QR
    upiQrImage?: string; // optional uploaded static QR (data URL)
    bank?: { name?: string; holder?: string; account?: string; ifsc?: string }; // for bank-transfer collections
    currency: string;
    plan: 'free' | 'pro' | 'business';
    settings: {
        lowStockThreshold: number;
        enableUdharReminders: boolean;
        invoicePrefix: string;
    };
    isActive: boolean;
}

export interface IBusinessDocument extends IBusiness, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const businessSchema = new Schema<IBusinessDocument>(
    {
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ['retail', 'wholesale'], required: true, index: true },
        ownerName: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, index: true },
        countryCode: { type: String, default: '+91' },
        email: { type: String, lowercase: true, trim: true },
        gstin: { type: String, uppercase: true, trim: true, sparse: true },
        address: String,
        city: String,
        state: String,
        pincode: String,
        logo: String,
        upiId: { type: String, trim: true },
        upiQrImage: String,
        bank: {
            name: String,
            holder: String,
            account: String,
            ifsc: { type: String, uppercase: true, trim: true },
        },
        currency: { type: String, default: 'INR' },
        plan: { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
        settings: {
            lowStockThreshold: { type: Number, default: 10 },
            enableUdharReminders: { type: Boolean, default: true },
            invoicePrefix: { type: String, default: 'INV' },
        },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true, collection: 'businesses' }
);

const Business: Model<IBusinessDocument> =
    mongoose.models.Business || mongoose.model<IBusinessDocument>('Business', businessSchema);

export default Business;
