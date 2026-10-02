/**
 * What each staff role may do. The owner may do everything.
 *
 * The app keeps a copy of this map in whoply-app/src/lib/permissions.ts to
 * hide screens and buttons — keep the two in step. The API check here is the
 * one that counts; the app copy is only for a tidy screen.
 */
import type { roles } from '../interfaces/index.js';

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
    'support.chat', // chat with the Whoply team (owner, manager)
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

export const can = (role: roles | undefined, perm: Perm): boolean => !!role && (ROLE_PERMS[role] || []).includes(perm);

/** Staff roles a business of this type can hire (a shop has no godown or field sales), least access first. */
export const staffRolesFor = (type?: string): roles[] =>
    type === 'wholesale' ? ['warehouse', 'salesStaff', 'manager', 'accountant'] : ['cashier', 'manager', 'accountant'];
