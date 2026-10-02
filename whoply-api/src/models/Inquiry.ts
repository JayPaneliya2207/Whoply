/**
 * Inquiry — a message from the "Contact us" form on the marketing site.
 * Anyone can send one (no login), so the public route validates hard and
 * limits how many one network address can send.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IInquiry {
    name: string;
    mobile: string;
    email?: string;
    businessType: 'retail' | 'wholesale' | 'other';
    city?: string;
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
        name: { type: String, required: true, trim: true, maxlength: 80 },
        mobile: { type: String, required: true },
        email: { type: String, lowercase: true, trim: true, maxlength: 120 },
        businessType: { type: String, enum: ['retail', 'wholesale', 'other'], default: 'other' },
        city: { type: String, trim: true, maxlength: 60 },
        message: { type: String, required: true, maxlength: 1000 },
        lang: String,
        status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
        note: { type: String, trim: true, maxlength: 500 },
        handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
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
