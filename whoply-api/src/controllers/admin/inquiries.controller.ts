/**
 * Inquiries from the marketing site — questions from "Contact us" and plan
 * requests from "Start free" / the plan buttons — and the admin's list of them.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { containsText } from '../../utils/search.js';
import { normalizePhone } from '../../utils/phone.js';
import Inquiry from '../../models/Inquiry.js';
import Plan from '../../models/Plan.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** One network address may send this many inquiries an hour. */
const PER_HOUR = 5;
const THANKS = 'Thank you — we will contact you soon';

const inquirySchema = z.object({
    kind: z.enum(['contact', 'plan']).optional(),
    name: z.string().trim().min(2, 'Enter your name').max(80, 'Name is too long'),
    mobile: z.string().trim().min(1, 'Enter your mobile number'),
    email: z.string().trim().max(120).email('Enter a valid email').optional().or(z.literal('')),
    businessName: z.string().trim().max(100, 'Business name is too long').optional(),
    businessType: z.enum(['retail', 'wholesale', 'other']).optional(),
    city: z.string().trim().max(60).optional(),
    plan: z.string().trim().toLowerCase().max(40).optional(),
    billing: z.enum(['monthly', 'yearly']).optional(),
    message: z.string().trim().max(1000, 'Message is too long (1000 characters max)').optional(),
    lang: z.enum(['en', 'hi', 'gu']).optional(),
    website: z.string().optional(), // hidden field: people leave it empty, form-filling bots don't
});

/**
 * POST /public/inquiries — no login. A question needs a message; a plan
 * request (kind "plan", or any request naming a plan) needs the business name
 * instead. Guards: strict validation, a hidden field that bots fill (they get
 * a polite "thanks" and nothing is saved), at most 5 an hour per address, and
 * the same request twice in 10 minutes is kept once.
 */
export const createInquiry = asyncHandler(async (req: Request, res: Response) => {
    const body = inquirySchema.parse(req.body);
    if (body.website) { sendCreated(res, { ok: true }, THANKS); return; }
    const mobile = normalizePhone(body.mobile);
    if (!/^[6-9]\d{9}$/.test(mobile)) throw AppError.badRequest('Enter a valid 10-digit mobile number');

    const kind = body.kind === 'plan' || body.plan ? 'plan' : 'contact';
    const message = body.message || '';
    if (kind === 'contact' && message.length < 5) throw AppError.badRequest('Tell us a little more (at least 5 characters)');
    if (kind === 'plan' && (body.businessName || '').length < 2) throw AppError.badRequest('Enter your business name');
    // Only a plan on sale is kept; an unknown key (an old page, a removed plan) is a request without a plan.
    const plan = body.plan ? await Plan.findOne({ key: body.plan, isActive: true }).select('key name').lean() : null;

    const ip = req.ip || '';
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (ip && (await Inquiry.countDocuments({ ip, createdAt: { $gte: hourAgo } })) >= PER_HOUR) {
        throw AppError.tooManyRequests('Too many messages from this network. Please try again in an hour.');
    }
    const repeat = await Inquiry.exists({ mobile, kind, message, plan: plan?.key, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } });
    if (!repeat) {
        await Inquiry.create({
            kind, name: body.name, mobile, email: body.email || undefined,
            businessName: body.businessName || undefined, businessType: body.businessType || 'other', city: body.city || undefined,
            plan: plan?.key, planName: plan?.name, billing: plan ? body.billing : undefined,
            message, lang: body.lang, ip,
        });
    }
    sendCreated(res, { ok: true }, THANKS);
});

/** New ones waiting: all of them, and how many of those are plan requests. */
const freshCounts = async () => {
    const [all, plans] = await Promise.all([Inquiry.countDocuments({ status: 'new' }), Inquiry.countDocuments({ status: 'new', kind: 'plan' })]);
    return { new: all, newPlans: plans };
};

/** GET /admin/inquiries?kind=contact|plan&status=new|contacted|closed&search=&page=&limit= */
export const listInquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (['new', 'contacted', 'closed'].includes(String(req.query.status))) filter.status = req.query.status;
    // Requests saved before "kind" existed are all questions.
    if (req.query.kind === 'plan') filter.kind = 'plan';
    else if (req.query.kind === 'contact') filter.kind = { $ne: 'plan' };
    if (req.query.search) {
        const digits = String(req.query.search).replace(/\D/g, '');
        filter.$or = [{ name: containsText(req.query.search) }, { businessName: containsText(req.query.search) }, { message: containsText(req.query.search) }, { city: containsText(req.query.search) }, ...(digits.length >= 3 ? [{ mobile: containsText(digits) }] : [])];
    }
    const [items, total, summary] = await Promise.all([
        Inquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Inquiry.countDocuments(filter),
        freshCounts(),
    ]);
    res.json({ success: true, data: { items, meta: meta(total), summary } });
});

/** GET /admin/inquiries/summary — how many are new, for the menu badge. */
export const inquirySummary = asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, await freshCounts());
});

/** PATCH /admin/inquiries/:id { status, note } */
export const updateInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
    const set: any = {};
    if (req.body.status !== undefined) {
        if (!['new', 'contacted', 'closed'].includes(req.body.status)) throw AppError.badRequest('status must be new, contacted or closed');
        set.status = req.body.status;
        set.handledBy = req.user!._id;
        set.handledAt = new Date();
    }
    if (req.body.note !== undefined) {
        const note = String(req.body.note).trim();
        if (note.length > 500) throw AppError.badRequest('Note is too long (500 characters max)');
        set.note = note;
    }
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true });
    if (!inquiry) throw AppError.notFound('Inquiry not found');
    sendSuccess(res, inquiry, 'Inquiry updated');
});

/** DELETE /admin/inquiries/:id — for spam. */
export const deleteInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
    const inquiry = await Inquiry.findByIdAndDelete(req.params.id);
    if (!inquiry) throw AppError.notFound('Inquiry not found');
    sendSuccess(res, { ok: true }, 'Inquiry deleted');
});
