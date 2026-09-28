import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { businessOf, paginate } from '../../utils/http.js';
import Customer from '../../models/Customer.js';
import CreditLedger from '../../models/CreditLedger.js';
import Invoice from '../../models/Invoice.js';
import { cleanGstin } from '../../utils/gstin.js';
import { normalizePhone } from '../../utils/phone.js';
import { containsText } from '../../utils/search.js';
import type { AuthRequest } from '../../interfaces/index.js';

export const listCustomers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = { businessId, isActive: true };
    // One box finds by name or mobile. Part of a number works too, typed with
    // spaces or a leading +91 / 0 (mobiles are stored as 10 digits).
    if (req.query.search) {
        const q = String(req.query.search);
        const digits = q.trim().replace(/^(\+\s*91|0)/, '').replace(/\D/g, '');
        filter.$or = [{ name: containsText(q) }, ...(digits.length >= 3 ? [{ mobile: containsText(digits) }] : [])];
    }
    if (req.query.hasDue === 'true') filter.creditBalance = { $gt: 0 };
    const [items, total] = await Promise.all([
        Customer.find(filter).sort({ creditBalance: -1, name: 1 }).skip(skip).limit(limit).lean(),
        Customer.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/**
 * The fields a client may set on a customer, validated. Udhar balance and
 * loyalty points are never taken from the client — only bills, repayments and
 * returns move them.
 */
async function customerFields(req: AuthRequest, opts: { create: boolean; id?: string }) {
    const b = req.body || {};
    const out: Record<string, any> = {};
    if (opts.create || b.name !== undefined) {
        const name = String(b.name ?? '').trim();
        if (!name) throw AppError.badRequest('Name is required');
        if (name.length > 80) throw AppError.badRequest('Name is too long (80 characters max)');
        out.name = name;
    }
    if (b.countryCode !== undefined) out.countryCode = /^\+\d{1,4}$/.test(String(b.countryCode)) ? String(b.countryCode) : '+91';
    if (b.mobile !== undefined) {
        const cc = out.countryCode || '+91';
        const mobile = cc === '+91' ? normalizePhone(b.mobile) : String(b.mobile).replace(/\D/g, '');
        if (mobile) {
            const ok = cc === '+91' ? /^[6-9]\d{9}$/.test(mobile) : /^\d{6,15}$/.test(mobile);
            if (!ok) throw AppError.badRequest('Enter a valid mobile number');
            // Billing finds a customer by mobile, so two active customers can't share one.
            const clash = await Customer.findOne({ businessId: businessOf(req), mobile, isActive: true, ...(opts.id && { _id: { $ne: opts.id } }) })
                .select('name')
                .lean();
            if (clash) throw AppError.conflict(`${clash.name} already has this mobile number`);
        }
        out.mobile = mobile || undefined;
    }
    if (b.gstin !== undefined) out.gstin = cleanGstin(b.gstin, (m) => AppError.badRequest(m)) ?? '';
    if (b.address !== undefined) {
        const address = String(b.address ?? '').trim();
        if (address.length > 200) throw AppError.badRequest('Address is too long (200 characters max)');
        out.address = address;
    }
    if (b.creditLimit !== undefined && b.creditLimit !== '') {
        const n = Number(b.creditLimit);
        if (!Number.isFinite(n) || n < 0) throw AppError.badRequest('Udhar limit must be 0 or more');
        out.creditLimit = n;
    }
    return out;
}

/** POST /customers */
export const createCustomer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const fields = await customerFields(req, { create: true });
    const customer = await Customer.create({ ...fields, businessId });
    sendCreated(res, customer);
});

/** PATCH /customers/:id */
export const updateCustomer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const fields = await customerFields(req, { create: false, id: String(req.params.id) });
    const unset: Record<string, 1> = {};
    if ('mobile' in fields && !fields.mobile) { delete fields.mobile; unset.mobile = 1; }
    const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, businessId, isActive: true },
        { $set: fields, ...(Object.keys(unset).length && { $unset: unset }) },
        { new: true, runValidators: true }
    );
    if (!customer) throw AppError.notFound('Customer not found');
    sendSuccess(res, customer, 'Customer updated');
});

/** DELETE /customers/:id — hide a customer. Not while they still owe udhar. */
export const deleteCustomer = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const customer = await Customer.findOne({ _id: req.params.id, businessId, isActive: true });
    if (!customer) throw AppError.notFound('Customer not found');
    if (Math.abs(customer.creditBalance) >= 0.01) {
        throw AppError.badRequest(`${customer.name} still has an udhar balance of ₹${customer.creditBalance.toFixed(2)} — settle it first`);
    }
    customer.isActive = false;
    await customer.save();
    sendSuccess(res, { ok: true }, 'Customer removed');
});

/** GET /customers/:id/ledger — the customer, every udhar entry, and their recent bills. */
export const getCustomerLedger = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const customer = await Customer.findOne({ _id: req.params.id, businessId }).lean();
    if (!customer) throw AppError.notFound('Customer not found');
    const [ledger, bills] = await Promise.all([
        CreditLedger.find({ businessId, customerId: customer._id }).sort({ createdAt: -1 }).limit(200).lean(),
        Invoice.find({ businessId, customerId: customer._id })
            .sort({ createdAt: -1 })
            .limit(30)
            .select('invoiceNo createdAt grandTotal paidAmount dueAmount status paymentMode payments')
            .lean(),
    ]);
    sendSuccess(res, { customer, ledger, bills });
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
