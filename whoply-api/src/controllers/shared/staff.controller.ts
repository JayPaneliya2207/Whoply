import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import { passwordSchema } from '../../validators/common.validator.js';
import { sanitizeKyc } from '../../utils/kyc.js';
import User from '../../models/User.js';
import { STAFF_ROLES, type AuthRequest, type roles } from '../../interfaces/index.js';
import { can, staffRolesFor } from '../../utils/permissions.js';
import { Types } from 'mongoose';
import { staffFields, findRehire, endSessions } from '../../utils/staff.js';

/** GET /staff — all staff of the business + monthly salary total */
export const listStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const staff = await User.find({ businessId, role: { $in: STAFF_ROLES }, isActive: true })
        .select('name mobile countryCode role salary kyc createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const monthlySalary = staff.reduce((s, u) => s + (u.salary || 0), 0);
    const byRole = STAFF_ROLES.map((r) => ({ role: r, count: staff.filter((s) => s.role === r).length })).filter((x) => x.count > 0);
    sendSuccess(res, { staff, monthlySalary, count: staff.length, byRole });
});

/**
 * POST /staff — add a staff member (creates a login for them). Someone removed
 * earlier from this shop, added again with the same mobile, gets their login back.
 */
export const createStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { role, kyc, password } = req.body;
    if (!role) throw AppError.badRequest('name, mobile and role are required');
    if (!staffRolesFor(req.user?.businessType).includes(role as roles)) throw AppError.badRequest('Invalid staff role');
    if (password) passwordSchema.parse(password); // same rule as every other password — else they could never log in
    const fields = staffFields(req.body, true);

    const back = await findRehire(fields.mobile, businessId);
    let staff;
    if (back) {
        Object.assign(back, fields, { role, isActive: true, kyc: sanitizeKyc(kyc) });
        if (password) back.password = password;
        staff = await back.save();
    } else {
        staff = await User.create({
            ...fields,
            role,
            businessId,
            kyc: sanitizeKyc(kyc), // Aadhaar: last 4 digits only, no photo
            ...(password && { password }),
        });
    }
    sendCreated(res, { _id: staff._id, name: staff.name, mobile: staff.mobile, role: staff.role, salary: staff.salary, kyc: staff.kyc }, back ? 'Staff added back' : 'Staff added');
});

/** PATCH /staff/:id */
export const updateStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = staffFields(req.body, false);
    if (req.body.kyc !== undefined) patch.kyc = sanitizeKyc(req.body.kyc);
    if (req.body.role !== undefined) {
        if (!staffRolesFor(req.user?.businessType).includes(req.body.role)) throw AppError.badRequest('Invalid staff role');
        patch.role = req.body.role;
    }
    const staff = await User.findOneAndUpdate(
        { _id: req.params.id, businessId, role: { $in: STAFF_ROLES }, isActive: true },
        patch,
        { new: true, runValidators: true }
    ).select('name mobile role salary kyc');
    if (!staff) throw AppError.notFound('Staff not found');
    sendSuccess(res, staff, 'Staff updated');
});

/** DELETE /staff/:id — deactivate */
export const deleteStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const staff = await User.findOneAndUpdate(
        { _id: req.params.id, businessId, role: { $in: STAFF_ROLES } },
        { isActive: false },
        { new: true }
    );
    if (!staff) throw AppError.notFound('Staff not found');
    await endSessions(staff._id); // signed out everywhere — an old token can't come back to life if they're re-hired
    sendSuccess(res, { ok: true }, 'Staff removed');
});

/** GET /staff/:id/detail — a staff member's profile (for sales reps: visits + orders) */
export const staffDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    // Only the owner sees salaries and ID details; a manager may open a sales rep's visits and orders.
    const full = can(req.user?.role, 'staff.manage');
    const staff = await User.findOne({ _id: req.params.id, businessId, role: full ? { $in: STAFF_ROLES } : 'salesStaff' })
        .select(full ? 'name mobile role salary kyc' : 'name mobile role')
        .lean();
    if (!staff) throw AppError.notFound('Staff not found');

    let visits: any[] = [];
    let orders: any[] = [];
    if (staff.role === 'salesStaff') {
        const bId = new Types.ObjectId(String(businessId));
        const Visit = (await import('../../models/Visit.js')).default;
        const Order = (await import('../../models/Order.js')).default;
        [visits, orders] = await Promise.all([
            Visit.find({ businessId: bId, salesRepId: staff._id }).sort({ visitedAt: -1 }).limit(30).lean(),
            Order.find({ businessId: bId, salesRepId: staff._id }).sort({ createdAt: -1 }).limit(30).lean(),
        ]);
    }
    sendSuccess(res, { staff, visits, orders });
});
