/**
 * Staff logins (shop staff and wholesale sales reps): checked fields, and hiring
 * someone again — a removed staff member's mobile stays taken by their old login
 * (mobile is unique), so adding them again brings that login back.
 */
import { AppError } from './AppError.js';
import { normalizePhone } from './phone.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { STAFF_ROLES } from '../interfaces/index.js';

/** Name (1-80 characters), a real mobile, salary 0 or more — only the fields present (all required on create). */
export function staffFields(body: any, creating: boolean) {
    const out: Record<string, any> = {};
    if (creating || body.name !== undefined) {
        out.name = String(body.name ?? '').trim();
        if (!out.name) throw AppError.badRequest('Name is required');
        if (out.name.length > 80) throw AppError.badRequest('Name is too long (80 characters max)');
    }
    if (creating) {
        const cc = /^\+\d{1,4}$/.test(String(body.countryCode)) ? String(body.countryCode) : '+91';
        const mobile = cc === '+91' ? normalizePhone(body.mobile ?? '') : String(body.mobile ?? '').replace(/\D/g, '');
        if (!(cc === '+91' ? /^[6-9]\d{9}$/ : /^\d{6,15}$/).test(mobile)) throw AppError.badRequest('Enter a valid mobile number');
        out.mobile = mobile;
        out.countryCode = cc;
    }
    if (creating || body.salary !== undefined) {
        const salary = body.salary === undefined || body.salary === '' ? 0 : Number(body.salary);
        if (!Number.isFinite(salary) || salary < 0) throw AppError.badRequest('Salary must be 0 or more');
        out.salary = Math.round(salary * 100) / 100;
    }
    return out;
}

/**
 * The login already using this mobile: none → create; a removed staff login of this
 * same business → returned, to be brought back; anyone else → "already exists".
 */
export async function findRehire(mobile: string, businessId: unknown) {
    const existing = await User.findOne({ mobile });
    if (!existing) return null;
    const sameShop = String(existing.businessId) === String(businessId);
    if (sameShop && !existing.isActive && (STAFF_ROLES as readonly string[]).includes(existing.role)) return existing;
    throw AppError.conflict(existing.isActive && sameShop ? 'This person is already on your staff' : 'A user with this mobile already exists');
}

/** Sign someone out everywhere (after removing them) — or everywhere except `keepToken` (after a password change). */
export async function endSessions(userId: unknown, keepToken?: string) {
    await Session.updateMany({ userId, isActive: true, ...(keepToken ? { token: { $ne: keepToken } } : {}) }, { $set: { isActive: false } });
}
