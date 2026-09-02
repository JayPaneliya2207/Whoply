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
    gstin?: string; // optional — dealers are usually registered (B2B); drives GST returns/e-invoice
    tier: DealerTier;
    city?: string;
    creditLimit: number;
    assignedRepId?: Types.ObjectId;
    lastReminderAt?: Date; // when the auto payment-reminder was last sent (de-dupe)
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
        gstin: { type: String, uppercase: true, trim: true },
        tier: { type: String, enum: ['A', 'B', 'C'], default: 'B' },
        city: String,
        creditLimit: { type: Number, default: 50000 },
        assignedRepId: { type: Schema.Types.ObjectId, ref: 'User' },
        lastReminderAt: { type: Date },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'dealers' }
);

// Dealer list (active per business) + the payment-reminder cron scan.
dealerSchema.index({ businessId: 1, isActive: 1 });
dealerSchema.index({ businessId: 1, lastReminderAt: 1 });

const Dealer: Model<IDealerDocument> = mongoose.models.Dealer || mongoose.model<IDealerDocument>('Dealer', dealerSchema);
export default Dealer;
