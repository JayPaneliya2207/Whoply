/**
 * Announcements (app popups) in the admin panel: create, edit, switch on / off,
 * set the dates, delete. The app side is controllers/shared/announcement.controller.ts.
 */
import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { cleanImage, cleanText } from '../../utils/image.js';
import { istDateRange, istYmd } from '../../utils/ist.js';
import Announcement, { announcementStatus } from '../../models/Announcement.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** A poster of about 1 MB (the admin panel shrinks pictures before sending). */
const MAX_IMAGE_CHARS = 1_400_000;
const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/i;

/** One India-time day from "YYYY-MM-DD"; '' or null clears the date. */
const day = (value: unknown, label: string) => {
    if (value === '' || value === null) return null;
    const range = typeof value === 'string' ? istDateRange(value) : null;
    if (!range) throw AppError.badRequest(`${label} must be a date (YYYY-MM-DD)`);
    return range;
};

/** The fields a request may set. Dates come as India-time days: it shows from the start of `startDate` to the end of `endDate`. */
function fields(b: any, create: boolean) {
    const set: Record<string, any> = {};
    const unset: Record<string, 1> = {};
    if (create || b.title !== undefined) {
        set.title = cleanText(b.title, 120, 'Headline');
        if (set.title.length < 2) throw AppError.badRequest('Write a headline');
    }
    if (b.body !== undefined) set.body = cleanText(b.body, 1000, 'Message');
    if (b.image !== undefined) {
        set.image = cleanImage(b.image, MAX_IMAGE_CHARS, 'Poster');
        set.hasImage = !!set.image;
    }
    if (b.linkUrl !== undefined) {
        set.linkUrl = cleanText(b.linkUrl, 300, 'Button link');
        if (set.linkUrl && !HTTPS_URL.test(set.linkUrl)) throw AppError.badRequest('The button link must start with https://');
    }
    if (b.linkLabel !== undefined) set.linkLabel = cleanText(b.linkLabel, 30, 'Button text');
    if (b.audience !== undefined) {
        if (!['all', 'retail', 'wholesale'].includes(b.audience)) throw AppError.badRequest('audience must be all, retail or wholesale');
        set.audience = b.audience;
    }
    if (b.staffToo !== undefined) set.staffToo = b.staffToo === true || b.staffToo === 'true';
    if (b.isActive !== undefined) set.isActive = b.isActive === true || b.isActive === 'true';
    if (b.startDate !== undefined) { const r = day(b.startDate, 'Start date'); if (r) set.startsAt = r.start; else unset.startsAt = 1; }
    if (b.endDate !== undefined) { const r = day(b.endDate, 'End date'); if (r) set.endsAt = r.end; else unset.endsAt = 1; }
    return { set, unset };
}

/** What the panel shows: the status, and the dates back as India-time days. */
const view = (a: any) => ({
    ...a,
    status: announcementStatus(a),
    startDate: a.startsAt ? istYmd(a.startsAt) : '',
    endDate: a.endsAt ? istYmd(new Date(+a.endsAt - 1)) : '', // endsAt is the first moment after the last day
});

/** GET /admin/announcements — newest first, without the posters (GET one for that). */
export const listAnnouncements = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const items = await Announcement.find({}).select('-image').sort({ createdAt: -1 }).limit(100).lean();
    sendSuccess(res, { items: items.map(view), live: items.filter((a) => announcementStatus(a) === 'live').length });
});

/** GET /admin/announcements/:id — with the poster */
export const getAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const a = await Announcement.findById(req.params.id).lean();
    if (!a) throw AppError.notFound('Popup not found');
    sendSuccess(res, view(a));
});

/** POST /admin/announcements */
export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { set } = fields(req.body, true);
    if (set.startsAt && set.endsAt && set.endsAt <= set.startsAt) throw AppError.badRequest('The end date is before the start date');
    if (set.linkUrl === '') delete set.linkUrl;
    const a = await Announcement.create({ ...set, createdBy: req.user!._id });
    sendCreated(res, view(a.toObject()), 'Popup created');
});

/** PATCH /admin/announcements/:id — any of the fields; { isActive } alone is the on / off switch */
export const updateAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const a = await Announcement.findById(req.params.id).select('startsAt endsAt');
    if (!a) throw AppError.notFound('Popup not found');
    const { set, unset } = fields(req.body, false);
    const startsAt = unset.startsAt ? undefined : set.startsAt ?? a.startsAt;
    const endsAt = unset.endsAt ? undefined : set.endsAt ?? a.endsAt;
    if (startsAt && endsAt && endsAt <= startsAt) throw AppError.badRequest('The end date is before the start date');
    const saved = await Announcement.findByIdAndUpdate(a._id, { $set: set, ...(Object.keys(unset).length && { $unset: unset }) }, { new: true, runValidators: true }).lean();
    sendSuccess(res, view(saved), 'Popup updated');
});

/** DELETE /admin/announcements/:id */
export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const a = await Announcement.findByIdAndDelete(req.params.id);
    if (!a) throw AppError.notFound('Popup not found');
    sendSuccess(res, { ok: true }, 'Popup deleted');
});
