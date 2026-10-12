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
import { twoStepStatus, startTwoStep, confirmTwoStep, turnOffTwoStep } from '../controllers/twoStep.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/sign-in-options', signInOptions);
router.post('/register', register);
router.post('/login', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/password-login', passwordLogin);

router.post('/onboarding', authenticate, onboarding);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

// Two-step sign-in — an admin turns it on or off for their own login
router.get('/two-step', authenticate, twoStepStatus);
router.post('/two-step/start', authenticate, startTwoStep);
router.post('/two-step/confirm', authenticate, confirmTwoStep);
router.post('/two-step/off', authenticate, turnOffTwoStep);

export default router;
