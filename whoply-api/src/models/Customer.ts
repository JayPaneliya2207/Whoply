/**
 * Customer — a retail buyer of a shop. Tracks udhar (credit) balance & loyalty.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface ICustomer {
    businessId: Types.ObjectId;
    name: string;
    mobile?: string;
    address?: string;
    creditBalance: number; // outstanding udhar (positive = customer owes shop)
    creditLimit: number;
    loyaltyPoints: number;
    isActive: boolean;
}
export interface ICustomerDocument extends ICustomer, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const customerSchema = new Schema<ICustomerDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        name: { type: String, required: true, trim: true },
        mobile: { type: String, index: true },
        address: String,
        creditBalance: { type: Number, default: 0 },
        creditLimit: { type: Number, default: 0 },
        loyaltyPoints: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'customers' }
);

const Customer: Model<ICustomerDocument> =
    mongoose.models.Customer || mongoose.model<ICustomerDocument>('Customer', customerSchema);
export default Customer;
