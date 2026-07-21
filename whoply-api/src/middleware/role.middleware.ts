/**
 * Role & business-type guards. Use after `authenticate`.
 */
import type { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest, roles, BusinessType } from '../interfaces/index.js';

export const requireRole =
    (...allowed: roles[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) return next(AppError.unauthorized('Not authenticated'));
        if (!allowed.includes(req.user.role)) {
            return next(AppError.forbidden('You do not have access to this resource'));
        }
        next();
    };

export const requireBusinessType =
    (...allowed: BusinessType[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) return next(AppError.unauthorized('Not authenticated'));
        if (!req.user.businessType || !allowed.includes(req.user.businessType)) {
            return next(AppError.forbidden('This feature is not available for your business type'));
        }
        next();
    };
