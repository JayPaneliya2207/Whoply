/**
 * Order — a wholesale bulk order from a dealer. Carries a status timeline
 * (pending → confirmed → dispatched → delivered) plus delivery/dispatch metadata.
 */
import mongoose, { Schema, type Document, type Types, type Model } from 'mongoose';

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
export type OrderSource = 'whatsapp' | 'phone' | 'manual' | 'field';

export interface IOrderItem {
    productId: Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
}

export interface IOrder {
    businessId: Types.ObjectId;
    orderNo: string;
    dealerId: Types.ObjectId;
    dealerName?: string;
    items: IOrderItem[];
    total: number;
    paidAmount: number;
    dueAmount: number;
    status: OrderStatus;
    source: OrderSource;
    salesRepId?: Types.ObjectId;
    dispatchedAt?: Date;
    deliveredAt?: Date;
    deliveryNote?: string;
}
export interface IOrderDocument extends IOrder, Document {
    _id: Types.ObjectId;
    createdAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        lineTotal: { type: Number, required: true },
    },
    { _id: false }
);

const orderSchema = new Schema<IOrderDocument>(
    {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
        orderNo: { type: String, required: true },
        dealerId: { type: Schema.Types.ObjectId, ref: 'Dealer', required: true, index: true },
        dealerName: String,
        items: { type: [orderItemSchema], default: [] },
        total: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'], default: 'pending', index: true },
        source: { type: String, enum: ['whatsapp', 'phone', 'manual', 'field'], default: 'manual' },
        salesRepId: { type: Schema.Types.ObjectId, ref: 'User' },
        dispatchedAt: Date,
        deliveredAt: Date,
        deliveryNote: String,
    },
    { timestamps: true, collection: 'orders' }
);
orderSchema.index({ businessId: 1, orderNo: 1 }, { unique: true });

const Order: Model<IOrderDocument> = mongoose.models.Order || mongoose.model<IOrderDocument>('Order', orderSchema);
export default Order;
