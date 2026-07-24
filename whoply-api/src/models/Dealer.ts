/**
 * Dealer — a retailer who buys from a wholesaler. Tier drives price-list pricing.
 * Outstanding owed is NOT stored here — it is derived from live order dues
 * (see utils/wholesaler.ts duesByDealer) so it can never drift out of sync.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type DealerTier = 'A' | 'B' | 'C';

export interface IDealer {
    businessId: Types.ObjectId;
    name: string;
    shopName?: string;
    mobile?: string;
    countryCode?: string;
    tier: DealerTier;
    city?: string;
    creditLimit: number;
    assignedRepId?: Types.ObjectId;
    isActive: boolean;
}
export interface IDealerDocument extends IDealer, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const dealerSchema = new Schema<IDealerDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        name: { type: String, required: true, trim: true },
        shopName: String,
        mobile: { type: String, index: true },
        countryCode: { type: String, default: '+91' },
        tier: { type: String, enum: ['A', 'B', 'C'], default: 'B' },
        city: String,
        creditLimit: { type: Number, default: 50000 },
        assignedRepId: { type: Schema.Types.ObjectId, ref: 'User' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'dealers' }
);

const Dealer: Model<IDealerDocument> = mongoose.models.Dealer || mongoose.model<IDealerDocument>('Dealer', dealerSchema);
export default Dealer;
