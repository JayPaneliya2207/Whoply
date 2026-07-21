/**
 * Authentication Middleware
 * Verifies JWT, checks the active session, attaches the user to the request.
 */
import type { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyToken, type ITokenPayload } from '../utils/jwt.js';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Session from '../models/Session.js';
import type { AuthRequest, AuthUser } from '../interfaces/index.js';

async function deactivateSessionByToken(token: string): Promise<void> {
    try {
        await Session.updateOne({ token, isActive: true }, { isActive: false });
    } catch {
        /* session may not exist */
    }
}

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw AppError.unauthorized('No token provided');
        }
        const token = authHeader.substring(7);

        let decoded: ITokenPayload;
        try {
            decoded = verifyToken(token);
        } catch (error: any) {
            if (error?.name === 'TokenExpiredError') {
                await deactivateSessionByToken(token);
                throw AppError.unauthorized('Token has expired. Please login again.');
            }
            throw AppError.unauthorized('Invalid token');
        }

        const user = await User.findById(decoded._id);
        if (!user) throw AppError.unauthorized('User not found');
        if (!user.isActive) throw AppError.unauthorized('Account is deactivated');

        const session = await Session.findOne({ token, userId: user._id, isActive: true });
        if (!session) {
            throw AppError.unauthorized(
                'Your session has expired or you were logged out from another device. Please login again.'
            );
        }
        session.lastActivityAt = new Date();
        await session.save();

        let businessType;
        if (user.businessId) {
            const business = await Business.findById(user.businessId).select('type').lean();
            businessType = business?.type;
        }

        const authUser: AuthUser = {
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            role: user.role,
            businessId: user.businessId,
            businessType,
            isActive: user.isActive,
        };
        req.user = authUser;
        next();
    } catch (error) {
        next(error);
    }
};
