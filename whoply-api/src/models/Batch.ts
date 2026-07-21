/**
 * Batch — a lot of a product with its own expiry & quantity (FEFO picking).
 * Used for grocery / bakery / cosmetics where expiry matters.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IBatch {
    businessId: Types.ObjectId;
    productId: Types.ObjectId;
    batchNo: string;
    expiryDate?: Date;
    quantity: number;
    costPrice: number;
}
export interface IBatchDocument extends IBatch, Document {
    _id: Types.ObjectId;
}

const batchSchema = new Schema<IBatchDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        batchNo: { type: String, required: true },
        expiryDate: { type: Date, index: true },
        quantity: { type: Number, default: 0 },
        costPrice: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'batches' }
);

const Batch: Model<IBatchDocument> = mongoose.models.Batch || mongoose.model<IBatchDocument>('Batch', batchSchema);
export default Batch;
