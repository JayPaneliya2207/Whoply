/**
 * Platform admin — logins across every business: list, add a staff login to a
 * business, change role / mobile / name / password, turn off, delete.
 *
 * Rules that keep a business usable and the console safe:
 * - only staff roles are made here (an owner comes with the business, admins
 *   are managed separately), and the role must fit the business type;
 * - an owner keeps the owner role and is never deleted (suspend the business);
 * - admin logins are not changed from this list — nobody locks everyone out;
 * - a login with bills or other records behind it is turned off, not deleted,
 *   so those records keep their author.
 */
import type { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import { containsText } from '../../utils/search.js';
import { passwordSchema } from '../../validators/common.validator.js';
import { staffRolesFor } from '../../utils/permissions.js';
import { staffFields, findRehire, endSessions } from '../../utils/staff.js';
import Business from '../../models/Business.js';
import User from '../../models/User.js';
import Invoice from '../../models/Invoice.js';
import Order from '../../models/Order.js';
import Quotation from '../../models/Quotation.js';
import CreditNote from '../../models/CreditNote.js';
import Payment from '../../models/Payment.js';
import Expense from '../../models/Expense.js';
import Visit from '../../models/Visit.js';
import Dealer from '../../models/Dealer.js';
import Notification from '../../models/Notification.js';
import Session from '../../models/Session.js';
import { VALID_ROLES, type AuthRequest, type roles } from '../../interfaces/index.js';

const LIST_FIELDS = 'name mobile countryCode role businessId isActive lastLogin createdAt';
const shape = (u: any) => ({ _id: u._id, name: u.name, mobile: u.mobile, countryCode: u.countryCode, role: u.role, businessId: u.businessId, isActive: u.isActive, lastLogin: u.lastLogin, createdAt: u.createdAt });

/**
 * GET /admin/users?search=&role=&businessId=&active=&page=&limit= — people across
 * tenants. Only what the list shows: never KYC documents, ID numbers, salary or
 * login secrets.
 */
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const filter: any = {};
    if (req.query.search) {
        const digits = String(req.query.search).replace(/\D/g, '');
        filter.$or = [{ name: containsText(req.query.search) }, ...(digits.length >= 3 ? [{ mobile: containsText(digits) }] : [])];
    }
    if (req.query.role && VALID_ROLES.includes(req.query.role as roles)) filter.role = req.query.role;
    if (req.query.businessId && Types.ObjectId.isValid(String(req.query.businessId))) filter.businessId = req.query.businessId;
    if (req.query.active === 'true' || req.query.active === 'false') filter.isActive = req.query.active === 'true';
    const [items, total] = await Promise.all([
        User.find(filter).select(LIST_FIELDS).populate('businessId', 'name type').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
    ]);
    sendPaginated(res, items, meta(total));
});

/** POST /admin/users — a staff login for a business (same checks as the owner adding staff). */
export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { businessId, role, password } = req.body;
    if (!businessId || !Types.ObjectId.isValid(String(businessId))) throw AppError.badRequest('Pick the business this login belongs to');
    const business = await Business.findById(businessId).select('type').lean();
    if (!business) throw AppError.notFound('Business not found');
    const allowed = staffRolesFor(business.type);
    if (!allowed.includes(role)) throw AppError.badRequest(`Role must be one of: ${allowed.join(', ')}`);
    if (password) passwordSchema.parse(String(password));
    const fields = staffFields(req.body, true);

    const back = await findRehire(fields.mobile, businessId); // 409 when the mobile is in use elsewhere
    let user;
    if (back) {
        Object.assign(back, fields, { role, isActive: true });
        if (password) back.password = password;
        user = await back.save();
    } else {
        user = await User.create({ ...fields, role, businessId, ...(password && { password }) });
    }
    sendCreated(res, shape(user), back ? 'Login added back' : 'User created');
});

/** PATCH /admin/users/:id — name, role, mobile, password, on/off. Never an admin — that could lock everyone out. */
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.params.id).select('name mobile countryCode role businessId isActive');
    if (!user) throw AppError.notFound('User not found');
    const body = req.body;

    if (user.role === 'admin') {
        if (body.isActive === false) throw AppError.badRequest('An admin login can not be turned off here');
        if (body.role !== undefined || body.mobile !== undefined || body.password !== undefined) throw AppError.badRequest('Admin logins can not be changed from this list');
    }
    if (typeof body.isActive === 'boolean') user.isActive = body.isActive;
    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) throw AppError.badRequest('Name is required');
        if (name.length > 80) throw AppError.badRequest('Name is too long (80 characters max)');
        user.name = name;
    }
    if (body.role !== undefined && body.role !== user.role) {
        if (user.role === 'owner') throw AppError.badRequest("The owner's role can not be changed");
        const business = await Business.findById(user.businessId).select('type').lean();
        const allowed = staffRolesFor(business?.type);
        if (!allowed.includes(body.role)) throw AppError.badRequest(`Role must be one of: ${allowed.join(', ')}`);
        user.role = body.role;
    }
    if (body.mobile !== undefined) {
        const cc = /^\+\d{1,4}$/.test(String(body.countryCode)) ? String(body.countryCode) : user.countryCode || '+91';
        const mobile = cc === '+91' ? normalizePhone(String(body.mobile)) : String(body.mobile).replace(/\D/g, '');
        if (!(cc === '+91' ? /^[6-9]\d{9}$/ : /^\d{6,15}$/).test(mobile)) throw AppError.badRequest('Enter a valid mobile number');
        if (mobile !== user.mobile) {
            if (await User.exists({ mobile, _id: { $ne: user._id } })) throw AppError.conflict('A user with this mobile already exists');
            user.mobile = mobile;
            user.countryCode = cc;
        }
    }
    let signOut = user.isModified('isActive') && !user.isActive;
    if (body.password !== undefined && body.password !== '') {
        passwordSchema.parse(String(body.password));
        user.password = String(body.password); // hashed by the model on save
        signOut = true;
    }
    await user.save();
    if (signOut) await endSessions(user._id); // a reset password or a switched-off login ends every open session
    // The business card shows the owner's mobile — keep it in step.
    if (user.role === 'owner' && body.mobile !== undefined) await Business.updateOne({ _id: user.businessId }, { $set: { mobile: user.mobile, countryCode: user.countryCode } });
    sendSuccess(res, shape(user), 'User updated');
});

/**
 * DELETE /admin/users/:id — remove a staff login. If bills, orders, visits or
 * payments were made by this person the login is only turned off, so those
 * records keep their author; otherwise it is deleted for good.
 */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.params.id).select('role businessId isActive');
    if (!user) throw AppError.notFound('User not found');
    if (user.role === 'admin') throw AppError.badRequest('Admin logins can not be deleted here');
    if (user.role === 'owner') throw AppError.badRequest('An owner can not be deleted — suspend the business instead');

    const id = user._id;
    const traces = await Promise.all([
        Invoice.exists({ createdBy: id }), Order.exists({ salesRepId: id }), Quotation.exists({ createdBy: id }),
        CreditNote.exists({ createdBy: id }), Payment.exists({ collectedBy: id }), Expense.exists({ createdBy: id }),
        Visit.exists({ salesRepId: id }), Dealer.exists({ assignedRepId: id }),
    ]);
    await endSessions(id);
    if (traces.some(Boolean)) {
        user.isActive = false;
        await user.save();
        sendSuccess(res, { ok: true, deleted: false }, 'This login made bills or other records, so it was turned off instead of deleted');
        return;
    }
    await Promise.all([User.deleteOne({ _id: id }), Session.deleteMany({ userId: id }), Notification.deleteMany({ userId: id })]);
    sendSuccess(res, { ok: true, deleted: true }, 'User deleted');
});
