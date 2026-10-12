/**
 * Shared interfaces & types
 */
import type { Request } from 'express';
import type { Types } from 'mongoose';

// Roles across the platform
export type roles =
    | 'owner' // shop / wholesale business owner
    | 'manager'
    | 'cashier' // retail POS operator
    | 'warehouse' // wholesale pick/pack
    | 'salesStaff' // wholesale field sales rep
    | 'accountant' // finance/reports
    | 'admin'; // a platform admin — a login of the admin panel, kept in its own collection (models/AdminUser.ts)

/** The roles a shop's own logins can have (the `users` collection). */
export type ShopRole = Exclude<roles, 'admin'>;
export const VALID_ROLES: ShopRole[] = ['owner', 'manager', 'cashier', 'warehouse', 'salesStaff', 'accountant'];

// Roles that count as "staff" (managed by the owner)
export const STAFF_ROLES: ShopRole[] = ['manager', 'cashier', 'warehouse', 'salesStaff', 'accountant'];

// Business type
export type BusinessType = 'retail' | 'wholesale';

// API response shapes
export interface IApiResponse<T> {
    success: true;
    data: T;
    message?: string;
}

export interface IApiError {
    success: false;
    error: { message: string; code?: string };
}

export interface IPaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IPaginatedResponse<T> {
    success: true;
    data: { items: T[]; meta: IPaginationMeta };
}

// Authenticated request user
export interface AuthUser {
    _id: Types.ObjectId;
    name: string;
    email?: string;
    mobile: string;
    role: roles;
    adminRole?: string; // platform admins: which admin role (utils/adminAccess.ts)
    businessId?: Types.ObjectId;
    businessType?: BusinessType;
    isActive: boolean;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}
