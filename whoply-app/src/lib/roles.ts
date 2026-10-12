import type { CSSProperties } from 'react';
import { Calculator, Crown, Route, ShoppingCart, UserCog, Warehouse, type LucideIcon } from 'lucide-react';

/**
 * How each login role is shown: its name (a translation key), a line that
 * tells a staff member what their login is for (owners need no such line),
 * an icon and a chip colour. Used on the home screen and the Staff screen.
 * What a role may actually do is in lib/permissions.ts.
 */
export interface RoleInfo { label: string; blurb?: string; icon: LucideIcon; tone: CSSProperties }

const tone = (name: 'brand' | 'warning' | 'success') => ({ background: `var(--${name}-tint)`, color: `var(--${name === 'brand' ? 'brand-text' : name})` });

const ROLES: Record<string, RoleInfo> = {
    owner: { label: 'roleOwner', icon: Crown, tone: { background: 'var(--accent-tint)', color: 'var(--accent-strong)' } },
    manager: { label: 'roleManager', blurb: 'roleBlurbManager', icon: UserCog, tone: tone('warning') },
    cashier: { label: 'roleCashier', blurb: 'roleBlurbCashier', icon: ShoppingCart, tone: tone('brand') },
    warehouse: { label: 'roleWarehouse', blurb: 'roleBlurbWarehouse', icon: Warehouse, tone: tone('success') },
    salesStaff: { label: 'roleSalesStaff', blurb: 'roleBlurbSalesStaff', icon: Route, tone: tone('brand') },
    accountant: { label: 'roleAccountant', blurb: 'roleBlurbAccountant', icon: Calculator, tone: { background: 'var(--surface-2)', color: 'var(--text-secondary)' } },
};

export const roleInfo = (role?: string): RoleInfo => ROLES[role || ''] || ROLES.owner;

/** "Good morning" / "Good afternoon" / "Good evening" (a translation key), by the clock of this device. */
export const greetingKey = (now: Date = new Date()): string => {
    const h = now.getHours();
    return h >= 5 && h < 12 ? 'goodMorning' : h >= 12 && h < 17 ? 'goodAfternoon' : 'goodEvening';
};
