/**
 * Role & business-type guards. Use after `authenticate`.
 */
import type { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest, roles, BusinessType } from '../interfaces/index.js';
import { can, type Perm } from '../utils/permissions.js';

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

/** Allow the request only if the user's role has any of these permissions (see utils/permissions.ts). */
export const requirePerm =
    (...perms: Perm[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) return next(AppError.unauthorized('Not authenticated'));
        if (!perms.some((p) => can(req.user!.role, p))) {
            return next(AppError.forbidden('Your role does not allow this'));
        }
        next();
    };
