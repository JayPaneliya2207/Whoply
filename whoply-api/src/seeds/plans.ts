/**
 * Default subscription plans, shared by `seed`, `seed:reset` and `migrate`.
 *
 * These feature lines are shown on the marketing site's pricing cards, so each
 * one must be something the product really does (landing-content.md §22):
 * no "WhatsApp reminders" — messaging.service is stubbed and reminders go out
 * by a tap on a wa.me link — and no "AI", since the reorder engine is a
 * transparent heuristic.
 */
import type { IPlan } from '../models/Plan.js';

export const DEFAULT_PLANS: Omit<IPlan, 'isActive'>[] = [
    { key: 'free', name: 'Free', price: 0, period: 'month', order: 1, highlight: false, features: ['1 shop', 'Unlimited billing', 'Basic inventory', 'Udhar tracking'] },
    { key: 'pro', name: 'Pro', price: 299, period: 'month', order: 2, highlight: true, features: ['Everything in Free', 'GST reports & e-invoice', 'Barcode scanning', '3 staff logins', 'Reminder lists'] },
    { key: 'business', name: 'Business', price: 799, period: 'month', order: 3, highlight: false, features: ['Everything in Pro', 'Full wholesale suite', 'Dealers & price lists', 'Dispatch & sales team', 'Reorder suggestions'] },
];

/**
 * Feature lines the old seed wrote → their replacements. `migrate` maps every
 * plan's features through this, so plans an admin has edited keep their other
 * lines untouched.
 */
export const PLAN_FEATURE_RENAMES: Record<string, string> = {
    'WhatsApp reminders': 'Reminder lists',
    'AI reorder': 'Reorder suggestions',
    'GST reports': 'GST reports & e-invoice',
    'Wholesale suite': 'Full wholesale suite',
    'Dealers & price-lists': 'Dealers & price lists',
    'Dispatch & sales-team': 'Dispatch & sales team',
};
