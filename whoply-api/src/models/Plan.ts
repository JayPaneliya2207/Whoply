/**
 * Plan — a subscription tier managed by the platform super-admin and shown on
 * the marketing site's pricing section. `key` links a Business.plan to a Plan.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IPlan {
    key: string; // 'free' | 'pro' | 'business' (or custom)
    name: string;
    price: number; // ₹ per period
    period: 'month' | 'year';
    features: string[];
    highlight: boolean; // "most popular"
    order: number;
    isActive: boolean;
}
export interface IPlanDocument extends IPlan, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const planSchema = new Schema<IPlanDocument>(
    {
        key: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        price: { type: Number, default: 0 },
        period: { type: String, enum: ['month', 'year'], default: 'month' },
        features: { type: [String], default: [] },
        highlight: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true, collection: 'plans' }
);

const Plan: Model<IPlanDocument> = mongoose.models.Plan || mongoose.model<IPlanDocument>('Plan', planSchema);
export default Plan;
