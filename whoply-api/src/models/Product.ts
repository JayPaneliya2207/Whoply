/**
 * Product — a sellable item. Stock is tracked here (currentStock) and detailed
 * per-batch in the Batch model for expiry (FEFO). GST via hsn + gstRate.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export interface IProduct {
    businessId: Types.ObjectId;
    categoryId?: Types.ObjectId;
    name: string;
    sku: string;
    barcode?: string;
    hsn?: string;
    unit: string; // pcs, kg, box, dozen...
    costPrice: number;
    sellPrice: number; // retail MRP / selling price
    wholesalePrice?: number; // base wholesale price (dealer tiers override)
    discountPct?: number; // optional default discount % applied at billing
    gstRate: number; // %
    currentStock: number;
    lowStockThreshold: number;
    /**
     * Denormalised `currentStock <= lowStockThreshold`. Kept in sync by
     * syncLowStock() after every stock mutation. Exists so low-stock queries can
     * use an index — a `$expr` field-to-field comparison cannot, and would force a
     * full scan of the tenant's products on every dashboard load and cron run.
     */
    isLowStock: boolean;
    trackExpiry: boolean;
    image?: string;
    isActive: boolean;
}
export interface IProductDocument extends IProduct, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const productSchema = new Schema<IProductDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
        name: { type: String, required: true, trim: true, index: true },
        sku: { type: String, required: true, trim: true },
        barcode: { type: String, trim: true },
        hsn: String,
        unit: { type: String, default: 'pcs' },
        costPrice: { type: Number, default: 0 },
        sellPrice: { type: Number, required: true, default: 0 },
        wholesalePrice: { type: Number, default: 0 },
        discountPct: { type: Number, default: 0, min: 0, max: 100 },
        gstRate: { type: Number, default: 0 },
        currentStock: { type: Number, default: 0 },
        lowStockThreshold: { type: Number, default: 10 },
        isLowStock: { type: Boolean, default: false },
        trackExpiry: { type: Boolean, default: false },
        image: String,
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true, collection: 'products' }
);
productSchema.index({ businessId: 1, sku: 1 }, { unique: true });
// Product list is business-scoped and name-sorted; low-stock filter/count uses the flag.
productSchema.index({ businessId: 1, isActive: 1, name: 1 });
productSchema.index({ businessId: 1, isActive: 1, isLowStock: 1 });
// Barcode / SKU scan-to-add lookups.
productSchema.index({ businessId: 1, barcode: 1 });

const Product: Model<IProductDocument> =
    mongoose.models.Product || mongoose.model<IProductDocument>('Product', productSchema);
export default Product;
