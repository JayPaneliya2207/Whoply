/**
 * Access control — admin logins and what each may do, plus the activity log.
 * Admin logins are their own collection (models/AdminUser.ts), apart from the
 * shop users: the same mobile number may be a shop's login as well.
 *
 * Safety rules: you can't change your own role, switch yourself off or delete
 * yourself; and there is always at least one active super admin, so the panel
 * can never be locked for everyone.
 */
import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import { paginate } from '../../utils/http.js';
import { normalizePhone } from '../../utils/phone.js';
import { endSessions } from '../../utils/staff.js';
import { ADMIN_ROLES, ADMIN_ROLE_KEYS, adminRoleOf, adminRoleFrom, type AdminRole } from '../../utils/adminAccess.js';
import AdminUser from '../../models/AdminUser.js';
import Session from '../../models/Session.js';
import AdminAudit from '../../models/AdminAudit.js';
import type { AuthRequest } from '../../interfaces/index.js';

const FIELDS = 'name mobile countryCode adminRole isActive lastLogin createdAt twoFactor.on';
const shape = (u: any) => ({ _id: u._id, name: u.name, mobile: u.mobile, adminRole: adminRoleFrom(u.adminRole), isActive: u.isActive, twoStep: !!u.twoFactor?.on, lastLogin: u.lastLogin, createdAt: u.createdAt });
/** An active super admin (a login made before roles existed has no adminRole and counts as one). */
const SUPER: Record<string, any> = { isActive: true, $or: [{ adminRole: 'super' }, { adminRole: { $exists: false } }, { adminRole: null }] };

/** An admin password: 8+ characters, and not the demo one. */
function adminPassword(raw: unknown): string {
    const password = String(raw ?? '');
    if (password.length < 8) throw AppError.badRequest('Admin password must be at least 8 characters');
    if (/^(whoply123|password|12345678)/i.test(password)) throw AppError.badRequest('Pick a password nobody can guess');
    return password;
}
function adminName(raw: unknown): string {
    const name = String(raw ?? '').trim();
    if (!name) throw AppError.badRequest('Name is required');
    if (name.length > 80) throw AppError.badRequest('Name is too long (80 characters max)');
    return name;
}
function roleKey(raw: unknown): AdminRole {
    if (!(ADMIN_ROLE_KEYS as readonly string[]).includes(String(raw))) throw AppError.badRequest(`Role must be one of: ${ADMIN_ROLE_KEYS.join(', ')}`);
    return raw as AdminRole;
}

/** GET /admin/access — the role map and what the signed-in admin may do (drives the panel's menu). */
export const accessInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
    const role = adminRoleOf(req.user)!;
    sendSuccess(res, {
        me: { id: req.user!._id, name: req.user!.name, adminRole: role, perms: ADMIN_ROLES[role].perms },
        roles: ADMIN_ROLE_KEYS.map((key) => ({ key, ...ADMIN_ROLES[key] })),
    });
});

/** GET /admin/admins */
export const listAdmins = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const admins = await AdminUser.find({}).select(FIELDS).sort({ createdAt: 1 }).lean();
    sendSuccess(res, admins.map(shape));
});

/** POST /admin/admins { name, mobile, password, adminRole } */
export const createAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const name = adminName(req.body.name);
    const adminRole = roleKey(req.body.adminRole);
    const password = adminPassword(req.body.password);
    const mobile = normalizePhone(String(req.body.mobile ?? ''));
    if (!/^[6-9]\d{9}$/.test(mobile)) throw AppError.badRequest('Enter a valid 10-digit mobile number');
    if (await AdminUser.exists({ mobile })) throw AppError.conflict('An admin login with this mobile already exists');
    const admin = await AdminUser.create({ name, mobile, adminRole, password });
    sendCreated(res, shape(admin), 'Admin login created');
});

/** PATCH /admin/admins/:id { name, adminRole, isActive, password } */
export const updateAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await AdminUser.findById(req.params.id).select(FIELDS);
    if (!admin) throw AppError.notFound('Admin login not found');
    const self = String(admin._id) === String(req.user!._id);
    const body = req.body;

    if (body.name !== undefined) admin.name = adminName(body.name);
    const wasSuper = adminRoleFrom(admin.adminRole) === 'super' && admin.isActive;
    if (body.adminRole !== undefined && body.adminRole !== adminRoleFrom(admin.adminRole)) {
        if (self) throw AppError.badRequest('You can not change your own role');
        admin.adminRole = roleKey(body.adminRole);
    }
    if (typeof body.isActive === 'boolean' && body.isActive !== admin.isActive) {
        if (self) throw AppError.badRequest('You can not turn off your own login');
        admin.isActive = body.isActive;
    }
    const stillSuper = adminRoleFrom(admin.adminRole) === 'super' && admin.isActive;
    if (wasSuper && !stillSuper && (await AdminUser.countDocuments({ ...SUPER, _id: { $ne: admin._id } })) === 0) {
        throw AppError.badRequest('There must be at least one active super admin');
    }
    let signOut = admin.isModified('isActive') && !admin.isActive;
    if (body.password !== undefined && body.password !== '') {
        admin.password = adminPassword(body.password);
        signOut = true;
    }
    await admin.save();
    // A new password or a switched-off login ends that admin's sessions (your own current one stays).
    if (signOut) await endSessions(admin._id, self ? req.headers.authorization?.substring(7) : undefined);
    sendSuccess(res, shape(admin), 'Admin login updated');
});

/** DELETE /admin/admins/:id */
export const deleteAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await AdminUser.findById(req.params.id).select(FIELDS);
    if (!admin) throw AppError.notFound('Admin login not found');
    if (String(admin._id) === String(req.user!._id)) throw AppError.badRequest('You can not delete your own login');
    if (adminRoleFrom(admin.adminRole) === 'super' && admin.isActive && (await AdminUser.countDocuments({ ...SUPER, _id: { $ne: admin._id } })) === 0) {
        throw AppError.badRequest('There must be at least one active super admin');
    }
    await Promise.all([AdminUser.deleteOne({ _id: admin._id }), Session.deleteMany({ userId: admin._id })]);
    sendSuccess(res, { ok: true }, 'Admin login deleted');
});

/** DELETE /admin/admins/:id/two-step — switch off another admin's two-step sign-in (their phone is lost). They are signed out and use the password alone until they turn it on again. */
export const resetAdminTwoStep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await AdminUser.findById(req.params.id).select(FIELDS);
    if (!admin) throw AppError.notFound('Admin login not found');
    if (String(admin._id) === String(req.user!._id)) throw AppError.badRequest('Turn off your own two-step sign-in from the account menu — it asks for your password and a code');
    if (!admin.twoFactor?.on) throw AppError.badRequest('Two-step sign-in is not on for this admin');
    await AdminUser.updateOne({ _id: admin._id }, { $unset: { twoFactor: 1 } });
    await endSessions(admin._id);
    sendSuccess(res, { ...shape(admin), twoStep: false }, 'Two-step sign-in is off for this admin');
});

/** GET /admin/audit?page=&limit= — what admins changed, newest first. */
export const listAudit = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { skip, limit, meta } = paginate(req.query);
    const [items, total] = await Promise.all([
        AdminAudit.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).select('adminName action detail path createdAt').lean(),
        AdminAudit.estimatedDocumentCount(),
    ]);
    sendPaginated(res, items, meta(total));
});
