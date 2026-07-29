import {
    ShoppingCart, Package, Users, FileText, Truck, Wallet, BarChart3, Tags, Route, Sparkles,
    Settings, UsersRound, ReceiptText, FileSpreadsheet, RotateCcw, Home,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';
import { RupeeIcon } from '@/components/RupeeIcon';

/** Any icon usable in the nav — Lucide icons or our custom RupeeIcon. */
type NavIcon = LucideIcon | ComponentType<{ size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }>;

export interface NavItem { href: string; key: string; icon: NavIcon }
export interface NavGroup { title: string; items: NavItem[] }

/* ── Dashboard home grid — grouped under headings ── */
export const retailGroups: NavGroup[] = [
    {
        title: 'quickAccess', items: [
            { href: '/billing', key: 'billing', icon: ShoppingCart },
            { href: '/bills', key: 'bills', icon: ReceiptText },
            { href: '/quotations', key: 'quotations', icon: FileText },
            { href: '/returns', key: 'returnsCreditNotes', icon: RotateCcw },
        ],
    },
    {
        title: 'inventoryGroup', items: [
            { href: '/products', key: 'products', icon: Package },
            { href: '/purchases', key: 'suppliers', icon: Truck },
        ],
    },
    {
        title: 'moneyReports', items: [
            { href: '/customers', key: 'customersUdhar', icon: Users },
            { href: '/expenses', key: 'expenses', icon: Wallet },
            { href: '/reports', key: 'reports', icon: BarChart3 },
            { href: '/gst', key: 'gstReturns', icon: FileSpreadsheet },
        ],
    },
    {
        title: 'moreGroup', items: [
            { href: '/staff', key: 'staff', icon: UsersRound },
            { href: '/insights', key: 'aiInsights', icon: Sparkles },
            { href: '/settings', key: 'settings', icon: Settings },
        ],
    },
];

export const wholesaleGroups: NavGroup[] = [
    {
        title: 'quickAccess', items: [
            { href: '/orders', key: 'orders', icon: FileText },
            { href: '/quotations', key: 'quotations', icon: FileText },
            { href: '/returns', key: 'returnsCreditNotes', icon: RotateCcw },
            { href: '/dispatch', key: 'dispatch', icon: Truck },
        ],
    },
    {
        title: 'dealersSales', items: [
            { href: '/dealers', key: 'dealers', icon: Users },
            { href: '/sales-team', key: 'salesTeam', icon: Route },
            { href: '/price-lists', key: 'priceLists', icon: Tags },
        ],
    },
    {
        title: 'moneyReports', items: [
            { href: '/payments', key: 'payments', icon: RupeeIcon },
            { href: '/reports', key: 'reports', icon: BarChart3 },
            { href: '/gst', key: 'gstReturns', icon: FileSpreadsheet },
        ],
    },
    {
        title: 'moreGroup', items: [
            { href: '/products', key: 'warehouse', icon: Package },
            { href: '/staff', key: 'staff', icon: UsersRound },
            { href: '/settings', key: 'settings', icon: Settings },
        ],
    },
];

export const groupsFor = (type?: string): NavGroup[] => (type === 'wholesale' ? wholesaleGroups : retailGroups);

/* ── Bottom tab bar — the main, daily-use screens ── */
export const retailTabs: NavItem[] = [
    { href: '/dashboard', key: 'home', icon: Home },
    { href: '/billing', key: 'billingShort', icon: ShoppingCart },
    { href: '/bills', key: 'bills', icon: ReceiptText },
    { href: '/customers', key: 'customersShort', icon: Users },
    { href: '/reports', key: 'reports', icon: BarChart3 },
];
export const wholesaleTabs: NavItem[] = [
    { href: '/dashboard', key: 'home', icon: Home },
    { href: '/orders', key: 'orders', icon: FileText },
    { href: '/dealers', key: 'dealers', icon: Users },
    { href: '/payments', key: 'payments', icon: RupeeIcon },
    { href: '/reports', key: 'reports', icon: BarChart3 },
];
export const tabsFor = (type?: string): NavItem[] => (type === 'wholesale' ? wholesaleTabs : retailTabs);
