import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Business from '../../models/Business.js';
import { cleanGstin } from '../../utils/gstin.js';
import { cleanImage, cleanText } from '../../utils/image.js';
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
    // Text only, with sensible lengths — an object or a huge string never reaches the database.
    const TEXT: [string, number][] = [['name', 120], ['ownerName', 80], ['mobile', 15], ['countryCode', 5], ['email', 120], ['address', 300], ['city', 60], ['state', 60], ['upiId', 80]];
    for (const [k, max] of TEXT) if (b[k] !== undefined) patch[k] = cleanText(b[k], max, k);
    if (patch.name !== undefined && !patch.name) throw AppError.badRequest('Shop name is required');
    if (patch.upiId && !/^[\w.-]{2,}@[a-zA-Z][\w.-]{1,}$/.test(patch.upiId)) throw AppError.badRequest('Enter a valid UPI ID (like name@bank), or leave it empty');
    if (b.upiQrImage !== undefined) patch.upiQrImage = cleanImage(b.upiQrImage, 1_500_000, 'QR picture');
    if (b.bank !== undefined) {
        if (!b.bank || typeof b.bank !== 'object' || Array.isArray(b.bank)) throw AppError.badRequest('Bank details are not valid');
        patch.bank = { name: cleanText(b.bank.name, 80, 'Bank name'), holder: cleanText(b.bank.holder, 80, 'Account holder'), account: cleanText(b.bank.account, 30, 'Account number'), ifsc: cleanText(b.bank.ifsc, 11, 'IFSC') };
    }
    if (b.gstin !== undefined) patch.gstin = cleanGstin(b.gstin, (m) => AppError.badRequest(m)) ?? '';
    if (b.settings && typeof b.settings === 'object') {
        const s = b.settings;
        if (s.invoicePrefix !== undefined) {
            const prefix = cleanText(s.invoicePrefix, 10, 'Bill prefix');
            if (prefix && !/^[A-Za-z0-9/_-]+$/.test(prefix)) throw AppError.badRequest('Bill prefix: letters, numbers, - _ / only');
            patch['settings.invoicePrefix'] = prefix || 'INV';
        }
        const whole = (k: string, min: number, max: number, label: string) => {
            if (s[k] === undefined) return;
            const n = Number(s[k]);
            if (!Number.isFinite(n) || n < min || n > max) throw AppError.badRequest(`${label} must be between ${min} and ${max}`);
            patch[`settings.${k}`] = Math.round(n);
        };
        whole('lowStockThreshold', 0, 1_000_000, 'Low-stock level');
        whole('udharReminderDays', 1, 365, 'Reminder days');
        if (s.enableUdharReminders !== undefined) patch['settings.enableUdharReminders'] = s.enableUdharReminders === true || s.enableUdharReminders === 'true';
    }
    const business = await Business.findByIdAndUpdate(businessId, { $set: patch }, { new: true, runValidators: true });
    if (!business) throw AppError.notFound('Business not found');
    sendSuccess(res, business, 'Shop details updated');
});
