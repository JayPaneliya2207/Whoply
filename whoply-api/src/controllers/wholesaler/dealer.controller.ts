import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Dealer from '../../models/Dealer.js';
import Order from '../../models/Order.js';
import type { AuthRequest } from '../../interfaces/index.js';

export const listDealers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    if (req.query.search) filter.name = { $regex: String(req.query.search), $options: 'i' };
    if (req.query.tier) filter.tier = req.query.tier;
    if (req.query.hasDue === 'true') filter.outstandingBalance = { $gt: 0 };
    const [items, total] = await Promise.all([
        Dealer.find(filter).sort({ outstandingBalance: -1, name: 1 }).skip(skip).limit(limit).lean(),
        Dealer.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

export const createDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (!req.body.name) throw AppError.badRequest('name is required');
    const dealer = await Dealer.create({ ...req.body, businessId });
    sendCreated(res, dealer);
});

export const updateDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = {};
    ['name', 'shopName', 'mobile', 'tier', 'city', 'creditLimit', 'assignedRepId'].forEach((k) => {
        if (req.body[k] !== undefined) patch[k] = req.body[k];
    });
    const dealer = await Dealer.findOneAndUpdate({ _id: req.params.id, businessId }, patch, { new: true });
    if (!dealer) throw AppError.notFound('Dealer not found');
    sendSuccess(res, dealer, 'Dealer updated');
});

export const deleteDealer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const dealer = await Dealer.findOneAndUpdate({ _id: req.params.id, businessId }, { isActive: false }, { new: true });
    if (!dealer) throw AppError.notFound('Dealer not found');
    sendSuccess(res, { ok: true }, 'Dealer removed');
});

export const dealerOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const dealer = await Dealer.findOne({ _id: req.params.id, businessId }).lean();
    if (!dealer) throw AppError.notFound('Dealer not found');
    const orders = await Order.find({ businessId, dealerId: dealer._id }).sort({ createdAt: -1 }).limit(50).lean();
    sendSuccess(res, { dealer, orders });
});

/** POST /dealers/:id/collect — record a payment against outstanding */
export const collectPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) throw AppError.badRequest('A positive amount is required');
    const dealer = await Dealer.findOne({ _id: req.params.id, businessId });
    if (!dealer) throw AppError.notFound('Dealer not found');
    dealer.outstandingBalance = +(dealer.outstandingBalance - amount).toFixed(2);
    await dealer.save();
    sendSuccess(res, dealer, 'Payment collected');
});
