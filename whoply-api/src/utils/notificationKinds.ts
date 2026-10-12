/**
 * Which notification kinds a role may know about. The day summary carries
 * sales and profit, "payable" the supplier dues, and so on — a cashier is
 * kept away from those numbers on every screen, so the notification list and
 * the phone notifications follow the same rule. "general" is for everyone.
 */
import { can, type Perm } from './permissions.js';

type Role = Parameters<typeof can>[0];

const NEEDS: Record<string, Perm[]> = {
    summary: ['profit.view'],
    payable: ['purchases.view'],
    subscription: ['business.edit'],
    support: ['support.chat'],
    udhar: ['customers.view', 'dealers.view'],
    low_stock: ['products.view'],
    expiry: ['products.view'],
    order: ['orders.view'],
};

export const roleMaySee = (role: Role, kind: string): boolean => !NEEDS[kind] || NEEDS[kind].some((p) => can(role, p));

/** Every kind this role may see, for a `type: { $in: … }` filter. */
export const kindsForRole = (role: Role): string[] => ['general', ...Object.keys(NEEDS).filter((k) => roleMaySee(role, k))];
