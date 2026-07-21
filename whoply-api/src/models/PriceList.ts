/**
 * PriceList — dealer-tier pricing for a product. One row per (product, tier).
 * e.g. Product X → A: ₹90, B: ₹92, C: ₹95.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';
import type { DealerTier } from './Dealer.js';

export interface IPriceList {
    businessId: Types.ObjectId;
    productId: Types.ObjectId;
    tier: DealerTier;
    price: number;
}
export interface IPriceListDocument extends IPriceList, Document {
    _id: Types.ObjectId;
}

const priceListSchema = new Schema<IPriceListDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        tier: { type: String, enum: ['A', 'B', 'C'], required: true },
        price: { type: Number, required: true },
    },
    { timestamps: true, collection: 'price_lists' }
);
priceListSchema.index({ businessId: 1, productId: 1, tier: 1 }, { unique: true });

const PriceList: Model<IPriceListDocument> =
    mongoose.models.PriceList || mongoose.model<IPriceListDocument>('PriceList', priceListSchema);
export default PriceList;
