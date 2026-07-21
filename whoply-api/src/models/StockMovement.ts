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

const StockMovement: Model<IStockMovementDocument> =
    mongoose.models.StockMovement || mongoose.model<IStockMovementDocument>('StockMovement', stockMovementSchema);
export default StockMovement;
