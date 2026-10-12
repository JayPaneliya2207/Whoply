/**
 * Inquiry — something a visitor sent from the marketing site. Two kinds:
 * a question from the "Contact us" form, and a plan request from the
 * "Start free" / plan buttons (the visitor wants an account — there is no
 * self sign-up, the admin creates it). Anyone can send one (no login), so the
 * public route validates hard and limits how many one network address can send.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IInquiry {
    kind: 'contact' | 'plan';
    name: string;
    mobile: string;
    email?: string;
    businessName?: string;
    businessType: 'retail' | 'wholesale' | 'other';
    city?: string;
    plan?: string; // the Plan.key they picked, if they picked one
    planName?: string; // its name on the day they asked (plans get renamed)
    billing?: 'monthly' | 'yearly';
    message: string;
    lang?: string;
    status: 'new' | 'contacted' | 'closed';
    note?: string; // the admin's own note
    handledBy?: Types.ObjectId;
    handledAt?: Date;
    ip?: string;
}
export interface IInquiryDocument extends IInquiry, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const inquirySchema = new Schema<IInquiryDocument>(
    {
        kind: { type: String, enum: ['contact', 'plan'], default: 'contact', index: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        mobile: { type: String, required: true },
        email: { type: String, lowercase: true, trim: true, maxlength: 120 },
        businessName: { type: String, trim: true, maxlength: 100 },
        businessType: { type: String, enum: ['retail', 'wholesale', 'other'], default: 'other' },
        city: { type: String, trim: true, maxlength: 60 },
        plan: { type: String, lowercase: true, trim: true, maxlength: 40 },
        planName: { type: String, trim: true, maxlength: 60 },
        billing: { type: String, enum: ['monthly', 'yearly'] },
        message: { type: String, default: '', maxlength: 1000 }, // a plan request may come without one
        lang: String,
        status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
        note: { type: String, trim: true, maxlength: 500 },
        handledBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
        handledAt: Date,
        ip: { type: String, select: false },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'inquiries' }
);
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ ip: 1, createdAt: -1 }); // the per-address limit
inquirySchema.index({ mobile: 1, createdAt: -1 }); // repeat-send check

const Inquiry: Model<IInquiryDocument> = mongoose.models.Inquiry || mongoose.model<IInquiryDocument>('Inquiry', inquirySchema);
export default Inquiry;
