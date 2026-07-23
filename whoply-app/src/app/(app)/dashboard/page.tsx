'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    TrendingUp, ShoppingBag, Wallet, AlertTriangle, IndianRupee, Package,
    ArrowUpRight, Trophy, Receipt, FileText, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { inr, inr2 } from '@/lib/cn';
import { useT } from '@/i18n';

const fetchDash = async (type: string) => {
    const base = type === 'wholesale' ? '/wholesaler/dashboard' : '/shopkeeper/dashboard';
    const { data } = await api.get(base);
    return data.data;
};

function StatCard({ label, value, icon: Icon, tone, delta }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="wp-card wp-card-hover p-5"
        >
            <div className="flex items-start justify-between">
                <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}>
                    <Icon size={20} />
                </div>
                {delta && (
                    <span className="wp-chip" style={{ background: 'var(--success-500)', color: '#fff' }}>
                        <ArrowUpRight size={12} /> {delta}
                    </span>
                )}
            </div>
            <p className="mt-4 text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        </motion.div>
    );
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
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('wholesalerDashboard')}</h1>
                    <Link href="/orders" className="wp-btn wp-btn-primary"><FileText size={16} /> {t('newOrder')}</Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard label={t('todaysOrders')} value={data.todayOrders} icon={ShoppingBag} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                    <StatCard label={t('pendingDispatch')} value={data.pendingDispatch} icon={Package} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
                    <StatCard label={t('outstanding')} value={inr(data.outstandingPayments)} icon={Wallet} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
                    <StatCard label={t('dealersCount')} value={data.dealerCount} icon={Users} tone={{ bg: '#e0e7ff', fg: 'var(--brand-700)' }} />
                    <StatCard label={t('warehouseUnits')} value={data.warehouseUnits} icon={Package} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                    <StatCard label={t('totalRevenue')} value={inr(data.revenue)} icon={TrendingUp} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
                </div>

                {/* Account tally — money to collect from dealers */}
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={17} style={{ color: 'var(--brand-700)' }} /> {t('moneyToCollect')}</h3>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <Link href="/dealers" className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dealersOweYou')}</p>
                            <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--accent-600)' }}>{inr(data.outstandingPayments || 0)}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{data.outstandingDealers || 0} {t('dealersWord')} ⬅</p>
                        </Link>
                        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('collected')}</p>
                            <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--success-600)' }}>{inr(Math.max(0, (data.revenue || 0) - (data.outstandingPayments || 0)))}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('received')}</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('totalBilled')}</p>
                            <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--text-primary)' }}>{inr(data.revenue || 0)}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('allOrders')}</p>
                        </div>
                    </div>
                    <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>Billed = Collected + Outstanding. “Dealers owe you” is what’s still to be received. Record dealer payments on the Dealers page.</p>
                </div>

                {/* Order pipeline — boxes */}
                <div>
                    <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('orderPipeline')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {data.statusBreakdown.map((s: any) => (
                            <Link key={s.status} href={`/orders?status=${s.status}`} className="wp-card wp-card-hover p-4">
                                <p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
                                <span className="wp-chip capitalize mt-1" style={statusTone[s.status]}>{stLabel(s.status)}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent orders — boxes (latest 4) */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('recentOrders')}</h3>
                        <Link href="/orders" className="text-sm font-semibold" style={{ color: 'var(--brand-700)' }}>{t('viewAll')} →</Link>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {data.recentOrders.length === 0 && <p className="col-span-full text-sm" style={{ color: 'var(--text-muted)' }}>{t('noOrdersYet')}</p>}
                        {data.recentOrders.slice(0, 4).map((o: any) => (
                            <Link key={o._id} href="/orders" className="wp-card wp-card-hover p-4 block">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p>
                                    <span className="wp-chip capitalize shrink-0" style={statusTone[o.status]}>{stLabel(o.status)}</span>
                                </div>
                                <p className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p>
                                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.dealerName}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('shopkeeperDashboard')}</h1>
                <Link href="/billing" className="wp-btn wp-btn-primary"><Receipt size={16} /> {t('newBill')}</Link>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={t('todaysSales')} value={inr(data.todaySales)} icon={IndianRupee} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} delta="live" />
                <StatCard label={t('todaysOrders')} value={data.todayOrders} icon={ShoppingBag} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                <StatCard label={t('todaysProfitEst')} value={inr(data.todayProfit || 0)} icon={TrendingUp} tone={{ bg: '#e0e7ff', fg: 'var(--brand-700)' }} />
                <StatCard label={t('pendingUdhar')} value={inr(data.pendingUdhar)} icon={Wallet} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
            </div>

            {/* Low stock + Udhar — two compact boxes on one line */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/products?lowStock=true" className="wp-card wp-card-hover p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1"><AlertTriangle size={17} style={{ color: 'var(--accent-500)' }} /><h3 className="font-bold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>{t('lowStockTitle')}</h3></div>
                    <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data.lowStockCount}</p>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>{t('productsNeedReorder')}</p>
                </Link>
                <Link href="/customers?hasDue=true" className="wp-card wp-card-hover p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1"><Wallet size={17} style={{ color: 'var(--accent-600)' }} /><h3 className="font-bold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>{t('udharTitle')}</h3></div>
                    <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data.udharCustomers}</p>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>{t('customersOwe')} {inr(data.pendingUdhar)}</p>
                </Link>
            </div>

            {/* Account tally — money owed both ways */}
            <div className="wp-card p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={17} style={{ color: 'var(--brand-700)' }} /> {t('moneyToSettle')}</h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Link href="/customers?hasDue=true" className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('customersOweYou')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--success-600)' }}>{inr(data.pendingUdhar || 0)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{data.udharCustomers || 0} {t('onUdharSuffix')} ⬅</p>
                    </Link>
                    <Link href="/purchases" className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('youOweSuppliers')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--accent-600)' }}>{inr(data.supplierPayable || 0)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{data.supplierPayableCount || 0} {t('suppliersCount')} ➡</p>
                    </Link>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('netPosition')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--text-primary)' }}>{inr((data.pendingUdhar || 0) - (data.supplierPayable || 0))}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{(data.pendingUdhar || 0) - (data.supplierPayable || 0) >= 0 ? t('inYourFavour') : t('youOweMore')}</p>
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

            {/* Recent bills — 4 boxes */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('recentBills')}</h3>
                    <Link href="/bills" className="text-sm font-semibold" style={{ color: 'var(--brand-700)' }}>{t('viewAll')} →</Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.recentInvoices.length === 0 && <p className="col-span-full text-sm" style={{ color: 'var(--text-muted)' }}>{t('noBillsYet')}</p>}
                    {data.recentInvoices.slice(0, 4).map((inv: any) => (
                        <Link key={inv._id} href="/bills" className="wp-card wp-card-hover p-4 block">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</p>
                                <span className="wp-chip shrink-0" style={inv.status === 'paid' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' }}>{inv.status}</span>
                            </div>
                            <p className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{inv.customerName || 'Walk-in'} · {inv.paymentMode}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
