/**
 * Auth Controller
 * Landing → login (OTP or password) → onboarding → dashboard, mirroring 1socio's flow.
 * OTP is fixed to 123456 in dev (see utils/otp).
 */
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { generateOtp, getOtpExpiry } from '../utils/otp.js';
import { generateToken } from '../utils/jwt.js';
import { maskMobile } from '../utils/masking.js';
import { normalizePhone } from '../utils/phone.js';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Session from '../models/Session.js';
import { loginSchema, verifyOtpSchema, passwordLoginSchema, registerSchema, onboardingSchema } from '../validators/auth.validator.js';
import type { AuthRequest } from '../interfaces/index.js';

const createSession = async (userId: any, mobile: string, role: any, businessId: any, req: AuthRequest) => {
    const token = generateToken({ _id: userId, role, mobile, businessId });
    await Session.create({
        token,
        userId,
        deviceInfo: {
            deviceName: (req.headers['user-agent'] as string)?.slice(0, 80) || 'Unknown device',
            ipAddress: req.ip || '',
        },
    });
    return token;
};

const publicUser = (user: any, business: any) => ({
    id: user._id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    language: user.language,
    avatar: user.avatar,
    business: business
        ? { id: business._id, name: business.name, type: business.type, plan: business.plan, gstin: business.gstin }
        : null,
    needsOnboarding: !user.businessId,
});

/** POST /api/auth/register — owner self sign-up */
export const register = asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const mobile = normalizePhone(body.mobile);

    const existing = await User.findOne({ mobile });
    if (existing) throw AppError.conflict('An account with this mobile already exists. Please login.');

    const otp = generateOtp();
    const user = await User.create({
        name: body.name,
        mobile,
        countryCode: (req.body as any).countryCode || '+91',
        role: 'owner',
        language: body.language || 'en',
        ...(body.password && { password: body.password }),
        otp,
        otpExpiry: getOtpExpiry(),
    });

    sendCreated(
        res,
        { mobile: maskMobile(mobile), userId: user._id, ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }) },
        'Account created. Verify the OTP sent to your mobile.'
    );
});

/** POST /api/auth/login — request an OTP */
export const requestOtp = asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const mobile = normalizePhone(body.mobile);

    const user = await User.findOne({ mobile }).select('+otp +otpExpiry');
    if (!user) throw AppError.notFound('No account found for this mobile. Please sign up first.');
    if (!user.isActive) throw AppError.forbidden('Account is deactivated');

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = getOtpExpiry();
    await user.save();

    // In prod: dispatch SMS via your provider here. Dev returns the OTP for convenience.
    sendSuccess(res, { mobile: maskMobile(mobile), ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }) }, 'OTP sent successfully');
});

/** POST /api/auth/verify-otp — verify OTP and issue token */
export const verifyOtp = asyncHandler(async (req, res) => {
    const body = verifyOtpSchema.parse(req.body);
    const mobile = normalizePhone(body.mobile);

    const user = await User.findOne({ mobile }).select('+otp +otpExpiry');
    if (!user) throw AppError.notFound('No account found for this mobile');
    if (!user.otp || !user.otpExpiry) throw AppError.badRequest('Please request an OTP first');
    if (user.otpExpiry < new Date()) throw AppError.badRequest('OTP has expired. Please request a new one.');
    if (user.otp !== body.otp) throw AppError.badRequest('Incorrect OTP');

    user.otp = undefined;
    user.otpExpiry = undefined;
    if (body.language) user.language = body.language;
    user.lastLogin = new Date();
    await user.save();

    const business = user.businessId ? await Business.findById(user.businessId) : null;
    const token = await createSession(user._id, user.mobile, user.role, user.businessId, req as AuthRequest);
    sendSuccess(res, { token, user: publicUser(user, business) }, 'Login successful');
});

/** POST /api/auth/password-login — login with a password */
export const passwordLogin = asyncHandler(async (req, res) => {
    const body = passwordLoginSchema.parse(req.body);
    const mobile = normalizePhone(body.mobile);

    const user = await User.findOne({ mobile }).select('+password');
    if (!user) throw AppError.notFound('No account found for this mobile');
    if (!user.isActive) throw AppError.forbidden('Account is deactivated');
    if (!user.password) throw AppError.badRequest('Password not set. Please login with OTP.');

    const ok = await user.comparePassword(body.password);
    if (!ok) throw AppError.badRequest('Incorrect password');

    if (body.language) user.language = body.language;
    user.lastLogin = new Date();
    await user.save();

    const business = user.businessId ? await Business.findById(user.businessId) : null;
    const token = await createSession(user._id, user.mobile, user.role, user.businessId, req as AuthRequest);
    sendSuccess(res, { token, user: publicUser(user, business) }, 'Login successful');
});

/** POST /api/auth/onboarding — create the business on first login */
export const onboarding = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized('Not authenticated');
    if (req.user.businessId) throw AppError.conflict('Business already set up');

    const body = onboardingSchema.parse(req.body);
    const business = await Business.create({
        name: body.businessName,
        type: body.type,
        ownerName: req.user.name,
        mobile: req.user.mobile,
        gstin: body.gstin,
        city: body.city,
        state: body.state,
    });

    const user = await User.findByIdAndUpdate(req.user._id, { businessId: business._id }, { new: true });
    sendCreated(res, { user: publicUser(user, business) }, 'Business created');
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized('Not authenticated');
    const user = await User.findById(req.user._id);
    if (!user) throw AppError.notFound('User not found');
    const business = user.businessId ? await Business.findById(user.businessId) : null;
    sendSuccess(res, { user: publicUser(user, business) });
});

/** PATCH /api/auth/profile — update name/email/language/avatar */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized('Not authenticated');
    const patch: any = {};
    if (req.body.name) patch.name = String(req.body.name).trim();
    if (req.body.email !== undefined) patch.email = req.body.email;
    if (req.body.language) patch.language = req.body.language;
    if (req.body.avatar !== undefined) patch.avatar = req.body.avatar;
    const user = await User.findByIdAndUpdate(req.user._id, patch, { new: true });
    if (!user) throw AppError.notFound('User not found');
    const business = user.businessId ? await Business.findById(user.businessId) : null;
    sendSuccess(res, { user: publicUser(user, business) }, 'Profile updated');
});

/** POST /api/auth/change-password */
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized('Not authenticated');
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) throw AppError.badRequest('New password must be at least 6 characters');

    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw AppError.notFound('User not found');
    // if a password already exists, verify the current one
    if (user.password) {
        if (!currentPassword) throw AppError.badRequest('Current password is required');
        const ok = await user.comparePassword(currentPassword);
        if (!ok) throw AppError.badRequest('Current password is incorrect');
    }
    user.password = newPassword;
    await user.save();
    sendSuccess(res, { ok: true }, 'Password changed');
});

/** POST /api/auth/logout */
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (token) await Session.updateOne({ token }, { isActive: false });
    sendSuccess(res, { ok: true }, 'Logged out');
});
