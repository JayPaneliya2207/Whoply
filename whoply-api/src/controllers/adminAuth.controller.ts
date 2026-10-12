/**
 * Admin panel sign-in.
 *
 * Admin logins live in their own collection (models/AdminUser.ts) and sign in
 * only here — never through the shop app's /auth/login or /auth/password-login,
 * which look at shop users alone.
 *
 *   POST /auth/admin-login   { mobile, password, code? } → token
 *   GET  /auth/me            (with an admin token) → the admin
 *
 * Two-step sign-in: an admin who turned it on (controllers/twoStep.controller.ts)
 * gets 401 CODE_NEEDED after a right password and sends the code with the next try.
 */
import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/response.js';
import { assertIpAllowed, assertNotLocked, failedFromIp, wrongTry, clearWrongTries } from '../utils/loginGuard.js';
import { generateToken } from '../utils/jwt.js';
import { normalizePhone } from '../utils/phone.js';
import { adminRoleFrom } from '../utils/adminAccess.js';
import { isDevMode, DEMO_PASSWORD } from '../utils/devMode.js';
import { mobileSchema } from '../validators/common.validator.js';
import { TWO_STEP_FIELDS, CODE_NEEDED, spendCode } from '../services/twoStep.service.js';
import AdminUser from '../models/AdminUser.js';
import Session from '../models/Session.js';
import type { AuthRequest } from '../interfaces/index.js';

const adminLoginSchema = z.object({
    mobile: mobileSchema,
    password: z.string().min(1, 'Enter your password'),
    /** The second step: an authenticator code or a recovery code. */
    code: z.string().trim().max(40).optional(),
});

/** What the admin panel keeps about the signed-in admin. */
export const publicAdmin = (admin: any) => ({
    id: admin._id,
    name: admin.name,
    mobile: admin.mobile,
    email: admin.email,
    role: 'admin' as const,
    adminRole: adminRoleFrom(admin.adminRole),
    twoStep: !!admin.twoFactor?.on,
    language: 'en',
    business: null,
    needsOnboarding: false,
});

/**
 * Two-step sign-in is on: the password alone is not enough. Called only after
 * the password was right. Without a code it answers 401 CODE_NEEDED and the
 * sign-in screen asks for one; a wrong code counts towards the lock like a
 * wrong password.
 */
const secondStep = async (admin: any, code: string | undefined, ip?: string) => {
    if (!admin.twoFactor?.on) return;
    if (!code) throw new AppError('Enter the 6-digit code from your authenticator app.', 401, CODE_NEEDED);
    const result = await spendCode(admin, code);
    if (result === 'unreadable') throw AppError.internal('The code can not be checked on this server. Ask the server owner to switch two-step sign-in off (npm run admin:2fa-off).');
    if (result === 'used') throw AppError.badRequest('That code was already used. Wait for the next code and try again.');
    if (result === 'wrong') await wrongTry(admin, ip, 'Incorrect code', AdminUser);
};

/** POST /api/auth/admin-login — mobile + password (+ code); wrong tries count towards the lock */
export const adminLogin = asyncHandler(async (req, res) => {
    const body = adminLoginSchema.parse(req.body);
    const mobile = normalizePhone(body.mobile);
    assertIpAllowed(req.ip);
    // The demo logins' password is public (the repository is). It opens nothing on a live server.
    if (!isDevMode() && body.password === DEMO_PASSWORD) {
        failedFromIp(req.ip);
        throw AppError.unauthorized('This password is not allowed here. Set a new one with the setup command on the server.');
    }

    const admin = await AdminUser.findOne({ mobile }).select(`+password +lockedUntil ${TWO_STEP_FIELDS}`);
    if (!admin) {
        failedFromIp(req.ip);
        throw AppError.notFound('No admin login found for this mobile');
    }
    if (!admin.isActive) throw AppError.forbidden('Account is deactivated');
    assertNotLocked(admin, req.ip);
    if (!(await admin.comparePassword(body.password))) await wrongTry(admin, req.ip, 'Incorrect password', AdminUser);
    await secondStep(admin, body.code, req.ip);

    clearWrongTries(admin, req.ip);
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken({ _id: admin._id, role: 'admin', mobile: admin.mobile });
    await Session.create({
        token,
        userId: admin._id,
        deviceInfo: { deviceName: (req.headers['user-agent'] as string)?.slice(0, 80) || 'Unknown device', ipAddress: req.ip || '' },
    });
    sendSuccess(res, { token, user: publicAdmin(admin) }, 'Login successful');
});

/** GET /api/auth/me, asked with an admin's token */
export const adminMe = asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await AdminUser.findById(req.user!._id);
    if (!admin) throw AppError.notFound('Admin login not found');
    sendSuccess(res, { user: publicAdmin(admin) });
});
