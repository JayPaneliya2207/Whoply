/**
 * Contact inquiries: the public "Contact us" form on the marketing site, and
 * the admin's list of them.
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
import type { AuthRequest } from '../../interfaces/index.js';

/** One network address may send this many inquiries an hour. */
const PER_HOUR = 5;
const THANKS = 'Thank you — we will contact you soon';

const inquirySchema = z.object({
    name: z.string().trim().min(2, 'Enter your name').max(80, 'Name is too long'),
    mobile: z.string().trim().min(1, 'Enter your mobile number'),
    email: z.string().trim().max(120).email('Enter a valid email').optional().or(z.literal('')),
    businessType: z.enum(['retail', 'wholesale', 'other']).optional(),
    city: z.string().trim().max(60).optional(),
    message: z.string().trim().min(5, 'Tell us a little more (at least 5 characters)').max(1000, 'Message is too long (1000 characters max)'),
    lang: z.enum(['en', 'hi', 'gu']).optional(),
    website: z.string().optional(), // hidden field: people leave it empty, form-filling bots don't
});

/**
 * POST /public/inquiries — no login. Guards: strict validation, a hidden
 * field that bots fill (they get a polite "thanks" and nothing is saved), at
 * most 5 an hour per address, and the same message twice in 10 minutes is
 * kept once.
 */
export const createInquiry = asyncHandler(async (req: Request, res: Response) => {
    const body = inquirySchema.parse(req.body);
    if (body.website) { sendCreated(res, { ok: true }, THANKS); return; }
    const mobile = normalizePhone(body.mobile);
    if (!/^[6-9]\d{9}$/.test(mobile)) throw AppError.badRequest('Enter a valid 10-digit mobile number');

    const ip = req.ip || '';
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (ip && (await Inquiry.countDocuments({ ip, createdAt: { $gte: hourAgo } })) >= PER_HOUR) {
        throw AppError.tooManyRequests('Too many messages from this network. Please try again in an hour.');
    }
    const repeat = await Inquiry.exists({ mobile, message: body.message, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } });
    if (!repeat) {
        await Inquiry.create({ name: body.name, mobile, email: body.email || undefined, businessType: body.businessType || 'other', city: body.city || undefined, message: body.message, lang: body.lang, ip });
    }
    sendCreated(res, { ok: true }, THANKS);
});

/** GET /admin/inquiries?status=new|contacted|closed&search=&page=&limit= */
export const listInquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (['new', 'contacted', 'closed'].includes(String(req.query.status))) filter.status = req.query.status;
    if (req.query.search) {
        const digits = String(req.query.search).replace(/\D/g, '');
        filter.$or = [{ name: containsText(req.query.search) }, { message: containsText(req.query.search) }, { city: containsText(req.query.search) }, ...(digits.length >= 3 ? [{ mobile: containsText(digits) }] : [])];
    }
    const [items, total, fresh] = await Promise.all([
        Inquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Inquiry.countDocuments(filter),
        Inquiry.countDocuments({ status: 'new' }),
    ]);
    res.json({ success: true, data: { items, meta: meta(total), summary: { new: fresh } } });
});

/** GET /admin/inquiries/summary — how many are new, for the menu badge. */
export const inquirySummary = asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, { new: await Inquiry.countDocuments({ status: 'new' }) });
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
