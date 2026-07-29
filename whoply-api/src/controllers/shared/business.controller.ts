import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Business from '../../models/Business.js';
import { cleanGstin } from '../../utils/gstin.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** GET /business — the caller's own shop/business profile. */
export const getMyBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const business = await Business.findById(businessId).lean();
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, business);
});

/** PATCH /business — owner/manager edits shop identity (shown on bills). */
export const updateMyBusiness = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const b = req.body || {};
    const patch: any = {};
    (['name', 'ownerName', 'mobile', 'countryCode', 'email', 'address', 'city', 'state', 'upiId', 'upiQrImage', 'bank'] as const).forEach((k) => {
        if (b[k] !== undefined) patch[k] = b[k];
    });
    if (b.gstin !== undefined) patch.gstin = cleanGstin(b.gstin, (m) => AppError.badRequest(m)) ?? '';
    if (b.settings && typeof b.settings === 'object') {
        (['invoicePrefix', 'lowStockThreshold', 'enableUdharReminders', 'udharReminderDays'] as const).forEach((k) => {
            if (b.settings[k] !== undefined) patch[`settings.${k}`] = b.settings[k];
        });
    }
    const business = await Business.findByIdAndUpdate(businessId, patch, { new: true });
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, business, 'Shop details updated');
});
