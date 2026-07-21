import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface ICategory {
    businessId: Types.ObjectId;
    name: string;
    icon?: string;
    isActive: boolean;
}
export interface ICategoryDocument extends ICategory, Document {
    _id: Types.ObjectId;
}

const categorySchema = new Schema<ICategoryDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        name: { type: String, required: true, trim: true },
        icon: String,
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'categories' }
);
categorySchema.index({ businessId: 1, name: 1 }, { unique: true });

const Category: Model<ICategoryDocument> =
    mongoose.models.Category || mongoose.model<ICategoryDocument>('Category', categorySchema);
export default Category;
