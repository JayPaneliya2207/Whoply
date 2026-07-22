import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import User from '../../models/User.js';
import { STAFF_ROLES, type AuthRequest, type roles } from '../../interfaces/index.js';
import { Types } from 'mongoose';

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

/** POST /staff — add a staff member (creates a login for them) */
export const createStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { name, mobile, role, salary, kyc, password } = req.body;
    if (!name || !mobile || !role) throw AppError.badRequest('name, mobile and role are required');
    if (!STAFF_ROLES.includes(role as roles)) throw AppError.badRequest('Invalid staff role');

    const normalized = normalizePhone(mobile);
    const exists = await User.findOne({ mobile: normalized });
    if (exists) throw AppError.conflict('A user with this mobile already exists');

    const staff = await User.create({
        name,
        mobile: normalized,
        countryCode: req.body.countryCode || '+91',
        role,
        businessId,
        salary: Number(salary) || 0,
        kyc: kyc || {},
        ...(password && { password }),
    });
    sendCreated(res, { _id: staff._id, name: staff.name, mobile: staff.mobile, role: staff.role, salary: staff.salary, kyc: staff.kyc });
});

/** PATCH /staff/:id */
export const updateStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const patch: any = {};
    ['name', 'role', 'salary', 'kyc'].forEach((k) => {
        if (req.body[k] !== undefined) patch[k] = k === 'salary' ? Number(req.body[k]) : req.body[k];
    });
    if (patch.role && !STAFF_ROLES.includes(patch.role)) throw AppError.badRequest('Invalid staff role');
    const staff = await User.findOneAndUpdate(
        { _id: req.params.id, businessId, role: { $in: STAFF_ROLES } },
        patch,
        { new: true }
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
    sendSuccess(res, { ok: true }, 'Staff removed');
});

/** GET /staff/:id/detail — a staff member's profile (for sales reps: visits + orders) */
export const staffDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const staff = await User.findOne({ _id: req.params.id, businessId }).select('name mobile role salary kyc').lean();
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
