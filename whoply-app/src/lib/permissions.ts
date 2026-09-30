/**
 * What each staff role may do — a copy of whoply-api/src/utils/permissions.ts.
 * Keep the two in step. The API is the real check; this copy only hides the
 * screens, tabs and buttons a role cannot use.
 */
import { useAuth } from '@/stores/auth.store';

type roles = 'owner' | 'manager' | 'cashier' | 'warehouse' | 'salesStaff' | 'accountant' | 'admin';

export const PERMS = [
    'business.edit', // shop name, GSTIN, address, bill settings
    'staff.manage', // add / edit / remove staff logins, salaries
    'team.view', // sales-team screen, rep details, all visits
    'products.view',
    'products.manage', // add / edit / delete products and categories, adjust stock
    'products.cost', // see cost price
    'billing.sell', // make a bill (POS)
    'bills.view',
    'einvoice', // e-invoice and e-way bill JSON
    'quotations',
    'returns.create', // credit notes
    'returns.view',
    'customers.view',
    'customers.manage', // add / edit customers, take udhar repayments
    'customers.delete', // remove a customer (owner, manager)
    'purchases.view', // suppliers + purchase orders
    'purchases.manage',
    'expenses.view',
    'expenses.manage',
    'reports.view', // all reports: sales, profit, summary, CSV, tally
    'reports.dayClose', // today's cash tally only
    'gst.view',
    'profit.view', // profit numbers on the dashboard
    'insights', // AI reorder
    'dealers.view',
    'dealers.manage', // add / edit dealers
    'dealers.delete',
    'payments.collect', // take money from dealers
    'payments.view',
    'orders.view',
    'orders.create',
    'orders.status', // confirm / dispatch / deliver / cancel
    'priceList.view',
    'priceList.manage',
    'visits.record',
] as const;
export type Perm = (typeof PERMS)[number];

const ALL = [...PERMS] as Perm[];

export const ROLE_PERMS: Record<roles, readonly Perm[]> = {
    owner: ALL,
    admin: [], // platform admins use /api/admin, not a business's screens
    // Everything except staff logins and the business profile.
    manager: ALL.filter((p) => p !== 'business.edit' && p !== 'staff.manage'),
    // Shop counter: sell, bills, estimates, returns, customers & udhar, today's cash.
    cashier: [
        'products.view', 'billing.sell', 'bills.view', 'quotations', 'returns.create', 'returns.view',
        'customers.view', 'customers.manage', 'reports.dayClose',
    ],
    // Godown: stock and dispatch.
    warehouse: ['products.view', 'products.manage', 'products.cost', 'orders.view', 'orders.status', 'einvoice'],
    // Field sales: dealers, orders, estimates, collections, visits.
    salesStaff: [
        'products.view', 'dealers.view', 'dealers.manage', 'orders.view', 'orders.create', 'quotations',
        'payments.collect', 'payments.view', 'priceList.view', 'visits.record',
    ],
    // Books: read-only money, reports and GST.
    accountant: [
        'products.view', 'products.cost', 'bills.view', 'einvoice', 'returns.view', 'customers.view',
        'purchases.view', 'expenses.view', 'reports.view', 'reports.dayClose', 'gst.view', 'profit.view',
        'dealers.view', 'payments.view', 'orders.view',
    ],
};

export const can = (role: string | undefined, perm: Perm): boolean => !!role && (ROLE_PERMS[role as roles] || []).includes(perm);

/** Staff roles a business of this type can hire (a shop has no godown or field sales), least access first. */
export const staffRolesFor = (type?: string): roles[] =>
    type === 'wholesale' ? ['warehouse', 'salesStaff', 'manager', 'accountant'] : ['cashier', 'manager', 'accountant'];

/** `can` for the signed-in user: `const allowed = useCan(); allowed('bills.view')`. */
export function useCan() {
    const role = useAuth((s) => s.user?.role);
    return (perm: Perm) => can(role, perm);
}

/** The permission a screen needs (any one of them). Screens not listed are open to every role. */
export const PAGE_PERMS: Record<string, Perm[]> = {
    '/billing': ['billing.sell'],
    '/bills': ['bills.view'],
    '/quotations': ['quotations'],
    '/returns': ['returns.view'],
    '/products': ['products.view'],
    '/purchases': ['purchases.view'],
    '/customers': ['customers.view'],
    '/expenses': ['expenses.view'],
    '/reports': ['reports.view', 'reports.dayClose'],
    '/gst': ['gst.view'],
    '/insights': ['insights'],
    '/staff': ['staff.manage'],
    '/orders': ['orders.view'],
    '/dispatch': ['orders.status'],
    '/dealers': ['dealers.view'],
    '/payments': ['payments.view'],
    '/price-lists': ['priceList.view'],
    '/sales-team': ['team.view', 'visits.record'], // a rep sees only their own numbers
};

/** May this role open the screen at `href`? */
export const canOpen = (role: string | undefined, href: string): boolean => {
    const base = '/' + (href.split('?')[0].split('/')[1] || '');
    const need = PAGE_PERMS[base];
    return !need || need.some((p) => can(role, p));
};
