/**
 * What each kind of platform-admin login may do in the admin panel.
 *
 * An admin without an `adminRole` (the first admin, made by setup) is a super
 * admin. The admin panel reads this map from GET /admin/access to hide what a
 * login can't use — the check that counts is `requireAdminPerm` on the routes.
 */
import type { Response, NextFunction } from 'express';
import { AppError } from './AppError.js';
import type { AuthRequest } from '../interfaces/index.js';

export const ADMIN_PERMS = [
    'stats.view',
    'businesses.view',
    'businesses.manage', // create, edit, suspend, change plan
    'users.view',
    'users.manage', // add / edit / delete business logins
    'plans.view',
    'plans.manage',
    'billing.view',
    'billing.manage', // create bills, remind, mark paid, cancel
    'settings.manage', // company, payment details, reminders, templates
    'support.chat',
    'inquiries.view',
    'inquiries.manage',
    'admins.manage', // admin logins, roles and the activity log
] as const;
export type AdminPerm = (typeof ADMIN_PERMS)[number];

export const ADMIN_ROLE_KEYS = ['super', 'support', 'billing', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLE_KEYS)[number];

const VIEW: AdminPerm[] = ['stats.view', 'businesses.view', 'users.view', 'plans.view', 'billing.view', 'inquiries.view'];

export const ADMIN_ROLES: Record<AdminRole, { label: string; description: string; perms: readonly AdminPerm[] }> = {
    super: { label: 'Super admin', description: 'Everything, including admin logins and settings.', perms: ADMIN_PERMS },
    support: { label: 'Support', description: 'Answers support chats and contact inquiries. Sees businesses and users, changes nothing else.', perms: ['stats.view', 'businesses.view', 'users.view', 'plans.view', 'support.chat', 'inquiries.view', 'inquiries.manage'] },
    billing: { label: 'Billing', description: 'Subscription bills: create, remind, mark paid. Sees businesses and plans.', perms: ['stats.view', 'businesses.view', 'plans.view', 'billing.view', 'billing.manage'] },
    viewer: { label: 'Viewer', description: 'Can look at everything except admin logins and settings. Can not change anything.', perms: VIEW },
};

export const adminRoleOf = (user?: { role?: string; adminRole?: string }): AdminRole | null =>
    user?.role !== 'admin' ? null : (ADMIN_ROLE_KEYS as readonly string[]).includes(user.adminRole || '') ? (user.adminRole as AdminRole) : 'super';

export const adminCan = (user: { role?: string; adminRole?: string } | undefined, perm: AdminPerm): boolean => {
    const role = adminRoleOf(user);
    return !!role && ADMIN_ROLES[role].perms.includes(perm);
};

/** Allow the request if this admin login has any of these permissions. Use after `authenticate` + requireRole('admin'). */
export const requireAdminPerm =
    (...perms: AdminPerm[]) =>
    (req: AuthRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) return next(AppError.unauthorized('Not authenticated'));
        if (!perms.some((p) => adminCan(req.user, p))) return next(AppError.forbidden('Your admin role does not allow this'));
        next();
    };
