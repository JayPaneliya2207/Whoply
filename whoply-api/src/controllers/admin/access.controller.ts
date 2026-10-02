/**
 * Access control — admin logins and what each may do, plus the activity log.
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
import { ADMIN_ROLES, ADMIN_ROLE_KEYS, adminRoleOf, type AdminRole } from '../../utils/adminAccess.js';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import AdminAudit from '../../models/AdminAudit.js';
import type { AuthRequest } from '../../interfaces/index.js';

const FIELDS = 'name mobile countryCode role adminRole isActive lastLogin createdAt';
const shape = (u: any) => ({ _id: u._id, name: u.name, mobile: u.mobile, adminRole: adminRoleOf(u), isActive: u.isActive, lastLogin: u.lastLogin, createdAt: u.createdAt });
/** An active super admin (a login made before roles existed has no adminRole and counts as one). */
const SUPER: Record<string, any> = { role: 'admin', isActive: true, $or: [{ adminRole: 'super' }, { adminRole: { $exists: false } }, { adminRole: null }] };

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
    const admins = await User.find({ role: 'admin' }).select(FIELDS).sort({ createdAt: 1 }).lean();
    sendSuccess(res, admins.map(shape));
});

/** POST /admin/admins { name, mobile, password, adminRole } */
export const createAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const name = adminName(req.body.name);
    const adminRole = roleKey(req.body.adminRole);
    const password = adminPassword(req.body.password);
    const mobile = normalizePhone(String(req.body.mobile ?? ''));
    if (!/^[6-9]\d{9}$/.test(mobile)) throw AppError.badRequest('Enter a valid 10-digit mobile number');
    if (await User.exists({ mobile })) throw AppError.conflict('A user with this mobile already exists');
    const admin = await User.create({ name, mobile, role: 'admin', adminRole, password });
    sendCreated(res, shape(admin), 'Admin login created');
});

/** PATCH /admin/admins/:id { name, adminRole, isActive, password } */
export const updateAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' }).select(FIELDS);
    if (!admin) throw AppError.notFound('Admin login not found');
    const self = String(admin._id) === String(req.user!._id);
    const body = req.body;

    if (body.name !== undefined) admin.name = adminName(body.name);
    const wasSuper = adminRoleOf(admin) === 'super' && admin.isActive;
    if (body.adminRole !== undefined && body.adminRole !== adminRoleOf(admin)) {
        if (self) throw AppError.badRequest('You can not change your own role');
        admin.adminRole = roleKey(body.adminRole);
    }
    if (typeof body.isActive === 'boolean' && body.isActive !== admin.isActive) {
        if (self) throw AppError.badRequest('You can not turn off your own login');
        admin.isActive = body.isActive;
    }
    const stillSuper = adminRoleOf(admin) === 'super' && admin.isActive;
    if (wasSuper && !stillSuper && (await User.countDocuments({ ...SUPER, _id: { $ne: admin._id } })) === 0) {
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
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' }).select(FIELDS);
    if (!admin) throw AppError.notFound('Admin login not found');
    if (String(admin._id) === String(req.user!._id)) throw AppError.badRequest('You can not delete your own login');
    if (adminRoleOf(admin) === 'super' && admin.isActive && (await User.countDocuments({ ...SUPER, _id: { $ne: admin._id } })) === 0) {
        throw AppError.badRequest('There must be at least one active super admin');
    }
    await Promise.all([User.deleteOne({ _id: admin._id }), Session.deleteMany({ userId: admin._id })]);
    sendSuccess(res, { ok: true }, 'Admin login deleted');
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
