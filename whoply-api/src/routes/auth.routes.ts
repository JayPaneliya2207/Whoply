import { Router } from 'express';
import {
    register,
    signInOptions,
    requestOtp,
    verifyOtp,
    passwordLogin,
    onboarding,
    me,
    updateProfile,
    changePassword,
    logout,
} from '../controllers/auth.controller.js';
import { adminLogin, adminMe } from '../controllers/adminAuth.controller.js';
import { twoStepStatus, startTwoStep, confirmTwoStep, turnOffTwoStep } from '../controllers/twoStep.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest } from '../interfaces/index.js';
import type { RequestHandler } from 'express';

const router = Router();

const isAdmin = (req: AuthRequest) => req.user?.role === 'admin';
/** These are about a shop login's own account; an admin's token has no place in them. */
const shopLoginOnly: RequestHandler = (req, _res, next) => next(isAdmin(req as AuthRequest) ? AppError.forbidden('This is for shop logins. Admin logins are managed in the admin panel.') : undefined);

router.get('/sign-in-options', signInOptions);
router.post('/register', register);
router.post('/login', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/password-login', passwordLogin);
// The admin panel's own sign-in: admin logins are a separate collection (models/AdminUser.ts)
router.post('/admin-login', adminLogin);

router.post('/onboarding', authenticate, shopLoginOnly, onboarding);
router.get('/me', authenticate, (req, res, next) => (isAdmin(req as AuthRequest) ? adminMe : me)(req, res, next));
router.patch('/profile', authenticate, shopLoginOnly, updateProfile);
router.post('/change-password', authenticate, shopLoginOnly, changePassword);
router.post('/logout', authenticate, logout);

// Two-step sign-in — an admin turns it on or off for their own login
router.get('/two-step', authenticate, twoStepStatus);
router.post('/two-step/start', authenticate, startTwoStep);
router.post('/two-step/confirm', authenticate, confirmTwoStep);
router.post('/two-step/off', authenticate, turnOffTwoStep);

export default router;
