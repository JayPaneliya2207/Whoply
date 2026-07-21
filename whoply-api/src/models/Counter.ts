/**
 * Counter Model
 * Atomic, monotonically increasing sequence for predictable document numbers
 * (invoices, orders, receipts) per scope. Key encodes the scope, typically
 * `<kind>:<businessId>:<YYYYMM>`.
 */
import mongoose, { Schema, type Model, type Document } from 'mongoose';

export interface ICounter {
    key: string;
    value: number;
}
export interface ICounterDocument extends ICounter, Document {}

const counterSchema = new Schema<ICounterDocument>(
    {
        key: { type: String, required: true, unique: true, index: true },
        value: { type: Number, required: true, default: 0 },
    },
    { timestamps: true, collection: 'counters' }
);

const Counter: Model<ICounterDocument> =
    mongoose.models.Counter || mongoose.model<ICounterDocument>('Counter', counterSchema);

export async function nextSequence(key: string): Promise<number> {
    const doc = await Counter.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc!.value;
}

export default Counter;
