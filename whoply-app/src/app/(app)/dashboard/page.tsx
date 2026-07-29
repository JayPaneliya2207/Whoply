'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
    TrendingUp, ShoppingBag, Wallet, AlertTriangle,
    Trophy, ReceiptText, Users, Truck, ArrowRight, Boxes,
} from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { inr, inr2 } from '@/lib/cn';
import { useT } from '@/i18n';
import { NavGrid } from '@/components/NavGrid';
import { ShopStatusToggle } from '@/components/ShopStatusToggle';

const fetchDash = async (type: string) => {
    const base = type === 'wholesale' ? '/wholesaler/dashboard' : '/shopkeeper/dashboard';
    const { data } = await api.get(base);
    return data.data;
};

/** Premium KPI card — soft tinted icon, compact label, big number, optional alert dot + link. */
function Kpi({ label, value, icon: Icon, tone, hint, href, alert }: any) {
    const inner = (
        <>
            <div className="flex items-center justify-between">
                <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}><Icon size={18} /></div>
                {alert && <span className="h-2.5 w-2.5 rounded-full ring-4" style={{ background: tone.fg, boxShadow: `0 0 0 3px ${tone.bg}` }} />}
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-2xl sm:text-[26px] font-extrabold tabular leading-none mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
            {hint && <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-secondary)' }}>{hint}</p>}
        </>
    );
    const cls = 'wp-card wp-card-hover p-4 sm:p-5 block h-full';
    return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const t = useT();
    const stLabel = (s: string) => t('st' + s.charAt(0).toUpperCase() + s.slice(1));
    const type = user?.business?.type || 'retail';
    const { data, isLoading } = useQuery({ queryKey: ['dashboard', type], queryFn: () => fetchDash(type) });

    if (isLoading || !data) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="wp-card p-5 h-28 animate-pulse" />
                ))}
            </div>
        );
    }

    if (type === 'wholesale') {
        const statusTone: Record<string, any> = {
            pending: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
            confirmed: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
            dispatched: { background: '#fef3c7', color: 'var(--accent-600)' },
            delivered: { background: '#dcfce7', color: 'var(--success-600)' },
            cancelled: { background: '#fee2e2', color: 'var(--danger-500)' },
        };
        const pipeColor: Record<string, string> = { pending: '#94a3b8', confirmed: 'var(--brand-600)', dispatched: 'var(--accent-500)', delivered: 'var(--success-500)', cancelled: 'var(--danger-500)' };
        const T = {
            brand: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
            amber: { bg: '#fef3c7', fg: 'var(--accent-600)' },
            green: { bg: '#dcfce7', fg: 'var(--success-600)' },
            red: { bg: '#fee2e2', fg: 'var(--danger-500)' },
            sky: { bg: '#e0e7ff', fg: 'var(--brand-700)' },
        };
        const billed = data.revenue || 0;
        const outstanding = data.outstandingPayments || 0;
        const collected = Math.max(0, billed - outstanding);
        const collectedPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
        const pipeTotal = (data.statusBreakdown || []).reduce((s: number, x: any) => s + x.count, 0) || 1;
        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('wholesalerDashboard')}</p>
                        <h1 className="text-2xl font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{t('hi')}, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 pb-1">
                        <ShopStatusToggle />
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <Kpi label={t('todaysOrders')} value={data.todayOrders} icon={ShoppingBag} tone={T.brand} hint={`${inr(data.todaySales || 0)} ${t('billedTodayHint')}`} href="/orders" />
                    <Kpi label={t('pendingDispatch')} value={data.pendingDispatch} icon={Truck} tone={T.amber} hint={t('toShipHint')} href="/orders?status=pending" alert={data.pendingDispatch > 0} />
                    <Kpi label={t('outstanding')} value={inr(outstanding)} icon={Wallet} tone={T.amber} hint={`${data.outstandingDealers || 0} ${t('dealersToCollectHint')}`} href="/dealers" alert={outstanding > 0} />
                    <Kpi label={t('lowStockTitle')} value={data.lowStockCount || 0} icon={AlertTriangle} tone={T.red} hint={t('productsNeedReorder')} href="/products?lowStock=true" alert={(data.lowStockCount || 0) > 0} />
                    <Kpi label={t('totalRevenue')} value={inr(billed)} icon={TrendingUp} tone={T.green} hint={t('allTimeBilledHint')} />
                    <Kpi label={t('dealersCount')} value={data.dealerCount} icon={Users} tone={T.sky} hint={t('activeDealersHint')} href="/dealers" />
                </div>

                {/* Money to collect — collection progress */}
                <div className="wp-card p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('moneyToCollect')}</p>
                            <p className="text-3xl font-extrabold tabular mt-1 leading-none" style={{ color: 'var(--accent-600)' }}>{inr(outstanding)}</p>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{data.outstandingDealers || 0} {t('dealersWord')} · {t('dealersToCollectHint')}</p>
                        </div>
                        <Link href="/dealers" className="wp-btn wp-btn-ghost shrink-0"><Wallet size={15} /> {t('collectPayment')}</Link>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-medium" style={{ color: 'var(--success-600)' }}>{t('collected')} {inr(collected)}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{t('totalBilled')} {inr(billed)}</span>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${collectedPct}%`, background: 'var(--success-500)' }} />
                        </div>
                        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{collectedPct}% {t('collected').toLowerCase()} · {t('allOrders')}</p>
                    </div>
                </div>

                {/* Order pipeline — stacked bar + legend */}
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Boxes size={17} style={{ color: 'var(--brand-700)' }} /> {t('orderPipeline')}</h3>
                    <div className="flex h-3 rounded-full overflow-hidden gap-px" style={{ background: 'var(--surface-2)' }}>
                        {(data.statusBreakdown || []).map((s: any) => (
                            <div key={s.status} style={{ width: `${(s.count / pipeTotal) * 100}%`, background: pipeColor[s.status] || 'var(--surface-2)' }} title={`${stLabel(s.status)}: ${s.count}`} />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        {(data.statusBreakdown || []).map((s: any) => (
                            <Link key={s.status} href={`/orders?status=${s.status}`} className="flex items-center gap-2.5 rounded-xl p-2.5 wp-card-hover" style={{ background: 'var(--surface-2)' }}>
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pipeColor[s.status] }} />
                                <div className="min-w-0">
                                    <p className="text-lg font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
                                    <p className="text-[11px] capitalize truncate" style={{ color: 'var(--text-muted)' }}>{stLabel(s.status)}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent activity — order feed */}
                <div className="wp-card p-5">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('recentOrders')}</h3>
                        <Link href="/orders" className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--brand-700)' }}>{t('viewAll')} <ArrowRight size={14} /></Link>
                    </div>
                    {data.recentOrders.length === 0 && <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>{t('noOrdersYet')}</p>}
                    <div>
                        {data.recentOrders.slice(0, 5).map((o: any, idx: number) => (
                            <Link key={o._id} href="/orders" className="flex items-center gap-3 py-3" style={{ borderTop: idx ? '1px solid var(--card-border)' : 'none' }}>
                                <div className="h-9 w-9 grid place-items-center rounded-xl shrink-0" style={statusTone[o.status]}><ShoppingBag size={16} /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{o.dealerName} · {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p>
                                    <span className="wp-chip capitalize" style={statusTone[o.status]}>{stLabel(o.status)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* All features */}
                <div className="wp-card p-4 sm:p-5"><NavGrid /></div>
            </div>
        );
    }

    const rt = {
        brand: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' },
        amber: { bg: '#fef3c7', fg: 'var(--accent-600)' },
        green: { bg: '#dcfce7', fg: 'var(--success-600)' },
        red: { bg: '#fee2e2', fg: 'var(--danger-500)' },
        sky: { bg: '#e0e7ff', fg: 'var(--brand-700)' },
    };
    const invTone = (s: string) => (s === 'paid' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' });
    const receivable = data.pendingUdhar || 0;
    const payable = data.supplierPayable || 0;
    const net = receivable - payable;
    const settleTotal = receivable + payable || 1;
    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('shopkeeperDashboard')}</p>
                    <h1 className="text-2xl font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{t('hi')}, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 pb-1">
                    <ShopStatusToggle />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <Kpi label={t('todaysSales')} value={inr(data.todaySales)} icon={RupeeIcon} tone={rt.green} hint={`${t('todaysProfitEst')} ${inr(data.todayProfit || 0)}`} />
                <Kpi label={t('todaysOrders')} value={data.todayOrders} icon={ShoppingBag} tone={rt.brand} href="/bills" />
                <Kpi label={t('todaysProfitEst')} value={inr(data.todayProfit || 0)} icon={TrendingUp} tone={rt.sky} />
                <Kpi label={t('pendingUdhar')} value={inr(receivable)} icon={Wallet} tone={rt.amber} hint={`${data.udharCustomers || 0} ${t('onUdharSuffix')}`} href="/customers?hasDue=true" alert={receivable > 0} />
                <Kpi label={t('lowStockTitle')} value={data.lowStockCount} icon={AlertTriangle} tone={rt.red} hint={t('productsNeedReorder')} href="/products?lowStock=true" alert={data.lowStockCount > 0} />
                <Kpi label={t('youOweSuppliers')} value={inr(payable)} icon={Truck} tone={rt.amber} hint={`${data.supplierPayableCount || 0} ${t('suppliersCount')}`} href="/purchases" alert={payable > 0} />
            </div>

            {/* Money to settle — receivable vs payable balance */}
            <div className="wp-card p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('netPosition')}</p>
                <p className="text-3xl font-extrabold tabular mt-1 leading-none" style={{ color: net >= 0 ? 'var(--success-600)' : 'var(--danger-500)' }}>{inr(net)}</p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{net >= 0 ? t('inYourFavour') : t('youOweMore')}</p>
                <div className="mt-4">
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-px" style={{ background: 'var(--surface-2)' }}>
                        <div style={{ width: `${(receivable / settleTotal) * 100}%`, background: 'var(--success-500)' }} />
                        <div style={{ width: `${(payable / settleTotal) * 100}%`, background: 'var(--accent-500)' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2 gap-2">
                        <Link href="/customers?hasDue=true" className="flex items-center gap-1.5 min-w-0"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--success-500)' }} /><span className="truncate" style={{ color: 'var(--text-secondary)' }}>{t('customersOweYou')}</span> <b className="tabular shrink-0" style={{ color: 'var(--text-primary)' }}>{inr(receivable)}</b></Link>
                        <Link href="/purchases" className="flex items-center gap-1.5 min-w-0"><b className="tabular shrink-0" style={{ color: 'var(--text-primary)' }}>{inr(payable)}</b> <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{t('youOweSuppliers')}</span><span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--accent-500)' }} /></Link>
                    </div>
                </div>
            </div>

            {/* Top products — compact 2-column layout */}
            <div className="wp-card p-5">
                <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}><Trophy size={18} style={{ color: 'var(--accent-500)' }} /> {t('topProducts')}</h3>
                {data.topProducts.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noSalesThisMonth')}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                    {data.topProducts.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <span className="h-6 w-6 grid place-items-center rounded-md text-xs font-bold shrink-0" style={{ background: i < 3 ? 'var(--brand-100)' : 'var(--surface-2)', color: i < 3 ? 'var(--brand-800)' : 'var(--text-secondary)' }}>{i + 1}</span>
                            <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{p.qty} {t('sold')}</span>
                            <span className="text-sm font-semibold tabular shrink-0 w-20 text-right" style={{ color: 'var(--text-primary)' }}>{inr(p.revenue)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent activity — bills feed */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('recentBills')}</h3>
                    <Link href="/bills" className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--brand-700)' }}>{t('viewAll')} <ArrowRight size={14} /></Link>
                </div>
                {data.recentInvoices.length === 0 && <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>{t('noBillsYet')}</p>}
                <div>
                    {data.recentInvoices.slice(0, 5).map((inv: any, idx: number) => (
                        <Link key={inv._id} href="/bills" className="flex items-center gap-3 py-3" style={{ borderTop: idx ? '1px solid var(--card-border)' : 'none' }}>
                            <div className="h-9 w-9 grid place-items-center rounded-xl shrink-0" style={invTone(inv.status)}><ReceiptText size={16} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{inv.customerName || t('walkIn')} · {inv.paymentMode}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</p>
                                <span className="wp-chip capitalize" style={invTone(inv.status)}>{inv.status}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* All features */}
            <div className="wp-card p-4 sm:p-5"><NavGrid /></div>
        </div>
    );
}
