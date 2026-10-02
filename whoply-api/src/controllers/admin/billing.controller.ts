/**
 * Platform admin — subscription bills and the settings behind them.
 *
 * Money arrives outside the app (UPI / bank), so a bill is "paid" when the admin
 * says so. Sending the bill or a reminder writes an in-app notification for the
 * owner and returns the WhatsApp text; the admin panel opens it as a wa.me link.
 */
import type { Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { containsText } from '../../utils/search.js';
import { isValidGstin } from '../../utils/gstin.js';
import { istDayRange, istMonthStart } from '../../utils/ist.js';
import Business from '../../models/Business.js';
import Notification from '../../models/Notification.js';
import SubscriptionBill, { PAID_MODES } from '../../models/SubscriptionBill.js';
import PlatformSettings, { getPlatformSettings } from '../../models/PlatformSettings.js';
import { createBill, remindBill, billEveryone, billText } from '../../services/subscription.service.js';
import type { AuthRequest } from '../../interfaces/index.js';

const text = (max: number) => z.string().trim().max(max);
const settingsSchema = z
    .object({
        company: z.object({ name: text(120).min(1, 'Company name is required'), address: text(300), gstin: text(15), email: text(120), phone: text(20) }).partial(),
        billing: z
            .object({
                gstRate: z.coerce.number().min(0, 'GST % must be 0 to 28').max(28, 'GST % must be 0 to 28'),
                dueDays: z.coerce.number().int().min(0).max(60),
                upiId: text(80),
                bank: z.object({ name: text(80), holder: text(80), account: text(30), ifsc: text(11) }).partial(),
                autoBill: z.boolean(),
                remindDaysBefore: z.coerce.number().int().min(0).max(30),
                remindOverdueEvery: z.coerce.number().int().min(1).max(30),
            })
            .partial(),
        support: z.object({ whatsapp: text(15), email: text(120), hours: text(80) }).partial(),
        templates: z.object({ bill: text(600).min(10, 'The bill message is too short'), reminder: text(600).min(10, 'The reminder message is too short') }).partial(),
    })
    .partial();

/** { a: { b: 1 } } → { 'a.b': 1 } so a partial save never wipes the fields it didn't send. */
function flatten(obj: Record<string, any>, prefix = '', out: Record<string, any> = {}) {
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, `${prefix}${k}.`, out);
        else out[`${prefix}${k}`] = v;
    }
    return out;
}

/** GET /admin/settings */
export const getSettings = asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, await getPlatformSettings());
});

/** PUT /admin/settings — any part of the settings; what isn't sent stays as it is. */
export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = settingsSchema.parse(req.body);
    const gstin = body.company?.gstin?.toUpperCase();
    if (gstin && !isValidGstin(gstin)) throw AppError.badRequest('Enter a valid 15-character GSTIN, or leave it empty');
    if (gstin !== undefined) body.company!.gstin = gstin;
    const upi = body.billing?.upiId;
    if (upi && !/^[\w.-]{2,}@[a-zA-Z][\w.-]{1,}$/.test(upi)) throw AppError.badRequest('Enter a valid UPI ID (like name@bank), or leave it empty');
    const wa = body.support?.whatsapp;
    if (wa && !/^\d{10,15}$/.test(wa.replace(/\D/g, ''))) throw AppError.badRequest('Support WhatsApp must be a mobile number');
    if (wa !== undefined) body.support!.whatsapp = wa.replace(/\D/g, '');

    await getPlatformSettings(); // make sure the document exists
    const set = flatten(body);
    if (Object.keys(set).length) await PlatformSettings.updateOne({ key: 'main' }, { $set: set }, { runValidators: true });
    sendSuccess(res, await getPlatformSettings(), 'Settings saved');
});

/** What the admin panel needs to open WhatsApp for this bill. */
const whatsappFor = (kind: 'bill' | 'reminder', bill: any, settings: any) => ({ mobile: bill.ownerMobile, countryCode: bill.ownerCountryCode || '+91', text: billText(kind, bill, settings) });

/** GET /admin/bills?status=due|overdue|paid|cancelled&businessId=&search=&page=&limit= */
export const listBills = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const today = istDayRange().start;
    const filter: any = {};
    const status = String(req.query.status || '');
    if (status === 'overdue') Object.assign(filter, { status: 'due', dueDate: { $lt: today } });
    else if (['due', 'paid', 'cancelled'].includes(status)) filter.status = status;
    if (req.query.businessId && Types.ObjectId.isValid(String(req.query.businessId))) filter.businessId = req.query.businessId;
    if (req.query.search) filter.$or = [{ billNo: containsText(req.query.search) }, { businessName: containsText(req.query.search) }];

    const [items, total, dueAgg, paidAgg] = await Promise.all([
        SubscriptionBill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        SubscriptionBill.countDocuments(filter),
        SubscriptionBill.aggregate([
            { $match: { status: 'due' } },
            { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, overdue: { $sum: { $cond: [{ $lt: ['$dueDate', today] }, 1, 0] } }, overdueTotal: { $sum: { $cond: [{ $lt: ['$dueDate', today] }, '$total', 0] } }, claimed: { $sum: { $cond: [{ $ifNull: ['$claimedAt', false] }, 1, 0] } } } },
        ]),
        SubscriptionBill.aggregate([{ $match: { status: 'paid', paidAt: { $gte: istMonthStart() } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    ]);
    const due = dueAgg[0] || {};
    res.json({
        success: true,
        data: {
            items: items.map((b) => ({ ...b, overdue: b.status === 'due' && b.dueDate < today })),
            meta: meta(total),
            summary: {
                dueCount: due.count || 0, dueTotal: due.total || 0, overdueCount: due.overdue || 0, overdueTotal: due.overdueTotal || 0, claimedCount: due.claimed || 0,
                paidThisMonth: paidAgg[0]?.total || 0, paidCountThisMonth: paidAgg[0]?.count || 0,
            },
        },
    });
});

/** GET /admin/bills/:id — the bill, the WhatsApp texts and who issues it (for printing). */
export const getBill = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bill = await SubscriptionBill.findById(req.params.id).lean();
    if (!bill) throw AppError.notFound('Bill not found');
    const settings = await getPlatformSettings();
    sendSuccess(res, { bill, company: settings.company, billing: { upiId: settings.billing.upiId, bank: settings.billing.bank }, whatsapp: whatsappFor(bill.status === 'due' ? 'reminder' : 'bill', bill, settings) });
});

/** POST /admin/bills — bill one business for its next period (or a given start / amount). */
export const createBillFor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { businessId, periods, amount, note, periodStart } = req.body;
    if (!businessId || !Types.ObjectId.isValid(String(businessId))) throw AppError.badRequest('Pick a business');
    const business = await Business.findById(businessId).select('name plan isActive').lean();
    if (!business) throw AppError.notFound('Business not found');
    let start: Date | undefined;
    if (periodStart) {
        start = new Date(periodStart);
        if (Number.isNaN(+start)) throw AppError.badRequest('Period start is not a valid date');
    }
    if (amount !== undefined && amount !== '' && !(Number(amount) > 0)) throw AppError.badRequest('Amount must be more than 0');
    const settings = await getPlatformSettings();
    const bill = await createBill({
        business, settings, note, createdBy: req.user!._id, periodStart: start,
        periods: periods === undefined || periods === '' ? 1 : Number(periods),
        amount: amount === undefined || amount === '' ? undefined : Number(amount),
    });
    sendCreated(res, { bill, whatsapp: whatsappFor('bill', bill, settings) }, `Bill ${bill.billNo} created — the owner sees it in the app`);
});

/** POST /admin/bills/run — bill every paid-plan business that isn't billed past today. */
export const runBills = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await billEveryone(req.user!._id);
    sendSuccess(res, result, result.created ? `${result.created} bill(s) created` : 'Everyone is already billed');
});

/** POST /admin/bills/:id/remind — in-app reminder now; returns the WhatsApp text to send. */
export const remind = asyncHandler(async (req: AuthRequest, res: Response) => {
    const bill = await remindBill(String(req.params.id));
    if (!bill) throw AppError.badRequest('Only a bill that is still due can be reminded');
    sendSuccess(res, { bill, whatsapp: whatsappFor('reminder', bill, await getPlatformSettings()) }, 'Reminder sent in the app');
});

/** PATCH /admin/bills/:id — { status: 'paid', paidMode, paidRef, paidAt } or { status: 'cancelled' }. Only from "due". */
export const updateBill = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    if (status === 'paid') {
        const paidMode = req.body.paidMode || 'upi';
        if (!PAID_MODES.includes(paidMode)) throw AppError.badRequest(`Paid by must be one of: ${PAID_MODES.join(', ')}`);
        const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
        if (Number.isNaN(+paidAt) || +paidAt > Date.now() + 60_000) throw AppError.badRequest('Paid date can not be in the future');
        const bill = await SubscriptionBill.findOneAndUpdate(
            { _id: req.params.id, status: 'due' },
            { $set: { status: 'paid', paidAt, paidMode, paidRef: String(req.body.paidRef || '').trim().slice(0, 60) || undefined } },
            { new: true }
        );
        if (!bill) throw AppError.badRequest('Only a bill that is still due can be marked paid');
        // The plan is now paid up to the end of this bill's period (never moved backwards).
        await Business.updateOne({ _id: bill.businessId }, { $max: { planPaidUntil: bill.periodEnd } });
        await Notification.create({ businessId: bill.businessId, title: '✅ Payment received', body: `Thank you — bill ${bill.billNo} is paid. Your ${bill.planName} plan is active.`, type: 'subscription' });
        sendSuccess(res, bill, 'Marked paid');
        return;
    }
    if (status === 'cancelled') {
        const bill = await SubscriptionBill.findOneAndUpdate({ _id: req.params.id, status: 'due' }, { $set: { status: 'cancelled', note: String(req.body.note || '').trim().slice(0, 300) || undefined } }, { new: true });
        if (!bill) throw AppError.badRequest('Only a bill that is still due can be cancelled');
        sendSuccess(res, bill, 'Bill cancelled');
        return;
    }
    throw AppError.badRequest('status must be paid or cancelled');
});
