import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import { cleanGstin } from '../../utils/gstin.js';
import type { AuthRequest } from '../../interfaces/index.js';

export const listCustomers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    if (req.query.search) filter.name = { $regex: String(req.query.search), $options: 'i' };
    if (req.query.hasDue === 'true') filter.creditBalance = { $gt: 0 };
    const [items, total] = await Promise.all([
        Customer.find(filter).sort({ creditBalance: -1, name: 1 }).skip(skip).limit(limit).lean(),
        Customer.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

export const createCustomer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    if (!req.body.name) throw AppError.badRequest('name is required');
    const gstin = cleanGstin(req.body.gstin, (m) => AppError.badRequest(m));
    const customer = await Customer.create({ ...req.body, gstin, businessId });
    sendCreated(res, customer);
});

export const getCustomerLedger = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const customer = await Customer.findOne({ _id: req.params.id, businessId }).lean();
    if (!customer) throw AppError.notFound('Customer not found');
    const ledger = await CreditLedger.find({ businessId, customerId: customer._id }).sort({ createdAt: -1 }).lean();
    sendSuccess(res, { customer, ledger });
});

/** POST /customers/:id/repayment — customer pays back udhar */
export const recordRepayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) throw AppError.badRequest('A positive amount is required');

    const customer = await Customer.findOne({ _id: req.params.id, businessId });
    if (!customer) throw AppError.notFound('Customer not found');

    customer.creditBalance = +(customer.creditBalance - amount).toFixed(2);
    await customer.save();
    const entry = await CreditLedger.create({
        businessId,
        customerId: customer._id,
        type: 'repayment',
        amount,
        balanceAfter: customer.creditBalance,
        note: req.body.note || 'Udhar repayment',
    });
    sendCreated(res, { customer, entry }, 'Repayment recorded');
});
