/**
 * Wholesaler money helpers. A dealer's outstanding is the single source of truth =
 * the sum of that dealer's unpaid order dues. Deriving it (instead of trusting a
 * stored counter) keeps the Dealers list, dashboard and account tally consistent.
 */
import Order from '../models/Order.js';
import { Types } from 'mongoose';

export interface DealerDue {
    _id: Types.ObjectId;
    due: number;
    orders: number;
}

/** Outstanding grouped per dealer, from live order dues (only dealers who owe). Cancelled orders excluded. */
export async function duesByDealer(bId: Types.ObjectId): Promise<DealerDue[]> {
    return Order.aggregate([
        { $match: { businessId: bId, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$dealerId', due: { $sum: '$dueAmount' }, orders: { $sum: 1 } } },
    ]);
}
