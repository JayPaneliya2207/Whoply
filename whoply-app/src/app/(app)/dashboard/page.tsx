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
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Wholesaler Dashboard</h1>
                    <Link href="/orders" className="wp-btn wp-btn-primary"><FileText size={16} /> New Order</Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard label="Today's Orders" value={data.todayOrders} icon={ShoppingBag} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                    <StatCard label="Pending Dispatch" value={data.pendingDispatch} icon={Package} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
                    <StatCard label="Outstanding" value={inr(data.outstandingPayments)} icon={Wallet} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
                    <StatCard label="Dealers" value={data.dealerCount} icon={Users} tone={{ bg: '#e0e7ff', fg: 'var(--brand-700)' }} />
                    <StatCard label="Warehouse Units" value={data.warehouseUnits} icon={Package} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                    <StatCard label="Total Revenue" value={inr(data.revenue)} icon={TrendingUp} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="wp-card p-5 lg:col-span-2">
                        <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Orders</h3>
                        {/* mobile cards */}
                        <div className="sm:hidden space-y-2">
                            {data.recentOrders.map((o: any) => (
                                <div key={o._id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                                    <div className="min-w-0"><p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.dealerName}</p></div>
                                    <div className="text-right shrink-0 ml-2"><p className="font-bold tabular text-sm" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p><span className="wp-chip capitalize" style={statusTone[o.status]}>{o.status}</span></div>
                                </div>
                            ))}
                        </div>
                        {/* desktop table */}
                        <div className="hidden sm:block overflow-x-auto wp-scroll">
                            <table className="w-full text-sm">
                                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left">
                                    <th className="pb-2 font-medium">Order</th><th className="pb-2 font-medium">Dealer</th>
                                    <th className="pb-2 font-medium text-right">Amount</th><th className="pb-2 font-medium text-right">Status</th>
                                </tr></thead>
                                <tbody>
                                    {data.recentOrders.map((o: any) => (
                                        <tr key={o._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                            <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</td>
                                            <td className="py-2.5" style={{ color: 'var(--text-secondary)' }}>{o.dealerName}</td>
                                            <td className="py-2.5 text-right font-semibold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</td>
                                            <td className="py-2.5 text-right"><span className="wp-chip capitalize" style={statusTone[o.status]}>{o.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="wp-card p-5">
                        <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Order pipeline</h3>
                        <div className="space-y-2">
                            {data.statusBreakdown.map((s: any) => (
                                <div key={s.status} className="flex items-center justify-between">
                                    <span className="wp-chip capitalize" style={statusTone[s.status]}>{s.status}</span>
                                    <span className="font-bold tabular" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Shopkeeper Dashboard</h1>
                <Link href="/billing" className="wp-btn wp-btn-primary"><Receipt size={16} /> New Bill</Link>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Today's Sales" value={inr(data.todaySales)} icon={IndianRupee} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} delta="live" />
                <StatCard label="Today's Orders" value={data.todayOrders} icon={ShoppingBag} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                <StatCard label="Est. Monthly Profit" value={inr(data.estimatedProfit)} icon={TrendingUp} tone={{ bg: '#e0e7ff', fg: 'var(--brand-700)' }} />
                <StatCard label="Pending Udhar" value={inr(data.pendingUdhar)} icon={Wallet} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
                {/* Top products */}
                <div className="wp-card p-5 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Trophy size={18} style={{ color: 'var(--accent-500)' }} /> Top Products (this month)</h3>
                    </div>
                    <div className="space-y-3">
                        {data.topProducts.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="h-7 w-7 grid place-items-center rounded-lg text-xs font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                    <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.qty / (data.topProducts[0]?.qty || 1)) * 100)}%`, background: 'var(--brand-700)' }} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold tabular" style={{ color: 'var(--text-primary)' }}>{inr(p.revenue)}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.qty} sold</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alerts */}
                <div className="space-y-4">
                    <div className="wp-card p-5">
                        <div className="flex items-center gap-2 mb-1"><AlertTriangle size={18} style={{ color: 'var(--accent-500)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Low Stock</h3></div>
                        <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data.lowStockCount}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>products need reordering</p>
                        <Link href="/products?lowStock=true" className="text-sm font-semibold mt-2 inline-block" style={{ color: 'var(--brand-700)' }}>View products →</Link>
                    </div>
                    <div className="wp-card p-5">
                        <div className="flex items-center gap-2 mb-1"><Wallet size={18} style={{ color: 'var(--accent-600)' }} /><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Udhar</h3></div>
                        <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data.udharCustomers}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>customers owe {inr(data.pendingUdhar)}</p>
                        <Link href="/customers?hasDue=true" className="text-sm font-semibold mt-2 inline-block" style={{ color: 'var(--brand-700)' }}>Send reminders →</Link>
                    </div>
                </div>
            </div>

            {/* Recent invoices */}
            <div className="wp-card p-5">
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Bills</h3>

                {/* mobile: card list */}
                <div className="sm:hidden space-y-2">
                    {data.recentInvoices.map((inv: any) => (
                        <div key={inv._id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                            <div className="min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.customerName || 'Walk-in'} · {inv.paymentMode}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                                <p className="font-bold tabular text-sm" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</p>
                                <span className="wp-chip" style={inv.status === 'paid' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' }}>{inv.status}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* desktop: table */}
                <div className="hidden sm:block overflow-x-auto wp-scroll">
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                                <th className="pb-2 font-medium">Invoice</th>
                                <th className="pb-2 font-medium">Customer</th>
                                <th className="pb-2 font-medium">Payment</th>
                                <th className="pb-2 font-medium text-right">Amount</th>
                                <th className="pb-2 font-medium text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentInvoices.map((inv: any) => (
                                <tr key={inv._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</td>
                                    <td className="py-2.5" style={{ color: 'var(--text-secondary)' }}>{inv.customerName || 'Walk-in'}</td>
                                    <td className="py-2.5 capitalize" style={{ color: 'var(--text-secondary)' }}>{inv.paymentMode}</td>
                                    <td className="py-2.5 text-right font-semibold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</td>
                                    <td className="py-2.5 text-right">
                                        <span className="wp-chip" style={inv.status === 'paid'
                                            ? { background: '#dcfce7', color: 'var(--success-600)' }
                                            : { background: '#fef3c7', color: 'var(--accent-600)' }}>{inv.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
