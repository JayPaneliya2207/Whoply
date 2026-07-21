import { Router } from 'express';
import {
    register,
    requestOtp,
    verifyOtp,
    passwordLogin,
    onboarding,
    me,
    updateProfile,
    changePassword,
    logout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/password-login', passwordLogin);

router.post('/onboarding', authenticate, onboarding);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

export default router;
