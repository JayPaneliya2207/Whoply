/**
 * Announcements as the app sees them: the popups that are live right now for
 * this login, and the poster picture as a real image address.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import Announcement, { liveNow } from '../../models/Announcement.js';
import type { AuthRequest } from '../../interfaces/index.js';

/**
 * GET /announcements — what to pop up for this login: switched on, inside its
 * dates, meant for this kind of business, and (for staff) marked "staff too".
 * The poster is not in the reply; `imagePath` is where to load it from.
 */
export const activeAnnouncements = asyncHandler(async (req: AuthRequest, res: Response) => {
    const kinds = ['all', ...(req.user?.businessType ? [req.user.businessType] : [])];
    const filter: any = { ...liveNow(), audience: { $in: kinds } };
    if (req.user?.role !== 'owner') filter.staffToo = true;
    const items = await Announcement.find(filter).select('title body image hasImage linkUrl linkLabel updatedAt').sort({ createdAt: -1 }).limit(5).lean();
    sendSuccess(res, {
        items: items.map((a) => ({
            _id: a._id,
            title: a.title,
            body: a.body || '',
            linkUrl: a.linkUrl || '',
            linkLabel: a.linkLabel || '',
            // An https poster is used as it is; an uploaded one is served by the route below. ?v= changes when it is edited.
            imagePath: !a.hasImage ? '' : a.image?.startsWith('https://') ? a.image : `/public/announcements/${a._id}/image?v=${+a.updatedAt}`,
        })),
    });
});

const DATA_URL = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/s;

/**
 * GET /public/announcements/:id/image — the poster of a LIVE popup, as picture
 * bytes. No login: an <img> can't send one, and a poster is meant to be seen.
 * A popup that is off, ended or not started yet answers 404.
 */
export const announcementImage = asyncHandler(async (req: Request, res: Response) => {
    const a = await Announcement.findOne({ _id: req.params.id, ...liveNow() }).select('image').lean();
    const m = a?.image ? DATA_URL.exec(a.image) : null;
    if (!m) throw AppError.notFound('Picture not found');
    res.setHeader('Content-Type', m[1] === 'image/jpg' ? 'image/jpeg' : m[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); // the address changes (?v=) when the poster does
    res.send(Buffer.from(m[2].replace(/\s/g, ''), 'base64'));
});
