import { AppError } from './AppError.js';
import type { AuthRequest, IPaginationMeta } from '../interfaces/index.js';

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

/** Start/end of today in server local time. */
export const todayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

/** Start of current month. */
export const monthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
};
