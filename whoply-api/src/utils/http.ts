import { AppError } from './AppError.js';
import type { AuthRequest, IPaginationMeta } from '../interfaces/index.js';
import { istDayRange, istMonthStart } from './ist.js';

/** Resolve the caller's businessId or throw. */
export const businessOf = (req: AuthRequest) => {
    if (!req.user?.businessId) throw AppError.badRequest('Complete onboarding to set up your business first');
    return req.user.businessId;
};

/** Parse ?page=&limit= into skip/limit + a meta builder. */
export const paginate = (query: any) => {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const meta = (total: number): IPaginationMeta => ({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
    });
    return { page, limit, skip, meta };
};

/** [start, end) of today in India time (see utils/ist.ts). */
export const todayRange = () => istDayRange();

/** Start of the current month in India time. */
export const monthStart = () => istMonthStart();
