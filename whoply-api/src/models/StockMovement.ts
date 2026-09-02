/**
 * StockMovement — an immutable audit trail of every stock change:
 * sale, purchase, return, damage, adjustment. Reports & loss tracking read this.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type MovementReason = 'sale' | 'purchase' | 'return' | 'damage' | 'adjustment' | 'opening';

export interface IStockMovement {
    businessId: Types.ObjectId;
    productId: Types.ObjectId;
    reason: MovementReason;
    quantity: number; // + in, - out
    refType?: string; // 'Invoice' | 'PurchaseOrder' ...
    refId?: Types.ObjectId;
    note?: string;
}
export interface IStockMovementDocument extends IStockMovement, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovementDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        reason: {
            type: String,
            enum: ['sale', 'purchase', 'return', 'damage', 'adjustment', 'opening'],
            required: true,
        },
        quantity: { type: Number, required: true },
        refType: String,
        refId: Schema.Types.ObjectId,
        note: String,
    },
    { timestamps: true, collection: 'stock_movements' }
);

// Fastest-growing collection (one row per line item per sale/purchase/return).
// Without createdAt in the index, any date-sorted listing does a blocking in-memory
// sort over the tenant's whole history.
stockMovementSchema.index({ businessId: 1, createdAt: -1 });
stockMovementSchema.index({ businessId: 1, productId: 1, createdAt: -1 });

const StockMovement: Model<IStockMovementDocument> =
    mongoose.models.StockMovement || mongoose.model<IStockMovementDocument>('StockMovement', stockMovementSchema);
export default StockMovement;
