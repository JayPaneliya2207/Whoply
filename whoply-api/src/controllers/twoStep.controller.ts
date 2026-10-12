/**
 * Two-step sign-in — an admin turns it on or off for their own login.
 *
 *   GET  /auth/two-step            is it on, since when, recovery codes left
 *   POST /auth/two-step/start      { password } → the key to add to an authenticator app
 *   POST /auth/two-step/confirm    { code }     → on; returns the recovery codes, once
 *   POST /auth/two-step/off        { password, code }
 *
 * The sign-in side is in auth.controller.ts (`secondStep`). A lost phone: a
 * recovery code, or a super admin (DELETE /admin/admins/:id/two-step), or on
 * the server `npm run admin:2fa-off -- <mobile>`.
 */
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/response.js';
import { GUARD_FIELDS, assertNotLocked, wrongTry, clearWrongTries } from '../utils/loginGuard.js';
import { findStep, newRecoveryCodes, newSecret, otpauthUrl, recoveryHash, seal, unseal } from '../utils/totp.js';
import { TWO_STEP_FIELDS, spendCode } from '../services/twoStep.service.js';
import { endSessions } from '../utils/staff.js';
import User from '../models/User.js';
import AdminAudit from '../models/AdminAudit.js';
import type { AuthRequest } from '../interfaces/index.js';

const ALREADY_ON = 'Two-step sign-in is already on for this login';

/** The signed-in admin, with the hidden fields these steps read. */
async function adminLogin(req: AuthRequest) {
    if (!req.user) throw AppError.unauthorized('Not authenticated');
    if (req.user.role !== 'admin') throw AppError.forbidden('Two-step sign-in is for admin logins');
    const user = await User.findById(req.user._id).select(`+password ${GUARD_FIELDS} ${TWO_STEP_FIELDS} +twoFactor.pending +twoFactor.recovery`);
    if (!user) throw AppError.notFound('User not found');
    return user;
}

/** Asking for the password again: a session left open on a desk must not be enough. Wrong tries count as at sign-in. */
async function checkPassword(user: Awaited<ReturnType<typeof adminLogin>>, password: unknown, ip?: string) {
    assertNotLocked(user, ip);
    if (typeof password !== 'string' || !password) throw AppError.badRequest('Enter your password');
    if (!(await user.comparePassword(password))) await wrongTry(user, ip, 'Incorrect password');
}

const record = (req: AuthRequest, action: string) =>
    void AdminAudit.create({ adminId: req.user!._id, adminName: req.user!.name, action, detail: '', method: req.method, path: req.originalUrl.split('?')[0].replace(/^\/api/, ''), ip: req.ip || '' }).catch(() => {
        /* the log must never break the request */
    });

/** GET /auth/two-step */
export const twoStepStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminLogin(req);
    const on = !!user.twoFactor?.on;
    sendSuccess(res, { on, since: (on && user.twoFactor?.since) || null, recoveryLeft: on ? user.twoFactor?.recovery?.length || 0 : 0 });
});

/** POST /auth/two-step/start { password } — a new key; nothing changes at sign-in until it is confirmed. */
export const startTwoStep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminLogin(req);
    if (user.twoFactor?.on) throw AppError.conflict(ALREADY_ON);
    await checkPassword(user, req.body?.password, req.ip);

    const secret = newSecret();
    user.set('twoFactor.pending', seal(secret));
    clearWrongTries(user, req.ip);
    await user.save();
    sendSuccess(res, { secret, url: otpauthUrl(secret, user.mobile) }, 'Add this key to your authenticator app');
});

/** POST /auth/two-step/confirm { code } — the app shows the right code, so turn it on. */
export const confirmTwoStep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminLogin(req);
    if (user.twoFactor?.on) throw AppError.conflict(ALREADY_ON);
    const pending = user.twoFactor?.pending;
    const secret = unseal(pending);
    if (!pending || !secret) throw AppError.badRequest('Start the setup again');
    const step = findStep(secret, String(req.body?.code ?? '').replace(/[\s-]/g, ''));
    if (step === null) throw AppError.badRequest('That code is not right. Check that your phone sets its date and time automatically, then try the next code.');

    const codes = newRecoveryCodes();
    user.set('twoFactor.on', true);
    user.set('twoFactor.secret', pending);
    user.set('twoFactor.pending', undefined);
    user.set('twoFactor.lastStep', step);
    user.set('twoFactor.recovery', codes.map(recoveryHash));
    user.set('twoFactor.since', new Date());
    await user.save();
    // Anyone else signed in as this admin got there with the password alone.
    await endSessions(user._id, req.headers.authorization?.substring(7));
    record(req, 'Turned on two-step sign-in');
    sendSuccess(res, { recoveryCodes: codes }, 'Two-step sign-in is on');
});

/** POST /auth/two-step/off { password, code } — the code may be a recovery code. */
export const turnOffTwoStep = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminLogin(req);
    if (!user.twoFactor?.on) throw AppError.badRequest('Two-step sign-in is not on');
    await checkPassword(user, req.body?.password, req.ip);
    const result = await spendCode(user, req.body?.code);
    if (result === 'unreadable') throw AppError.internal('The code can not be checked on this server. Ask the server owner to switch two-step sign-in off (npm run admin:2fa-off).');
    if (result === 'used') throw AppError.badRequest('That code was already used. Wait for the next code and try again.');
    if (result === 'wrong') await wrongTry(user, req.ip, 'Incorrect code');

    await User.updateOne({ _id: user._id }, { $unset: { twoFactor: 1, loginFails: 1, loginFailAt: 1, lockedUntil: 1 } });
    record(req, 'Turned off two-step sign-in');
    sendSuccess(res, { on: false }, 'Two-step sign-in is off');
});
