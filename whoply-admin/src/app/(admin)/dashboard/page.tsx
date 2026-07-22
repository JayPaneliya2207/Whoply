'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, Store, Users, Receipt, IndianRupee, Layers, TrendingUp, Wallet, Power } from 'lucide-react';
import { api } from '@/lib/api';
import { inr } from '@/lib/cn';

function Stat({ label, value, icon: Icon, tone }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="wp-card wp-card-hover p-5">
            <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}><Icon size={20} /></div>
            <p className="mt-4 text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        </motion.div>
    );
}

export default function AdminDashboard() {
    const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: async () => (await api.get('/admin/stats')).data.data });
    if (isLoading || !data) return <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="wp-card h-28 animate-pulse" />)}</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Platform Overview</h1>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Stat label="Total Businesses" value={data.businesses} icon={Building2} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                <Stat label="Retail Shops" value={data.retail} icon={Store} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
                <Stat label="Wholesalers" value={data.wholesale} icon={Layers} tone={{ bg: '#fef3c7', fg: 'var(--accent-600)' }} />
                <Stat label="Users" value={data.users} icon={Users} tone={{ bg: '#e0e7ff', fg: 'var(--brand-700)' }} />
                <Stat label="Invoices" value={data.invoices} icon={Receipt} tone={{ bg: 'var(--brand-100)', fg: 'var(--brand-700)' }} />
                <Stat label="Platform GMV" value={inr(data.gmv)} icon={IndianRupee} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
            </div>

            {/* Account tally — subscription revenue */}
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="wp-card p-5" style={{ background: 'var(--brand-700)', color: '#fff' }}>
                    <div className="flex items-center gap-2 mb-1"><TrendingUp size={18} /><p className="text-sm opacity-90">Monthly Recurring Revenue</p></div>
                    <p className="text-3xl font-extrabold tabular">{inr(data.mrr || 0)}</p>
                    <p className="text-sm opacity-80 mt-1">≈ {inr(data.arr || 0)} / year</p>
                </div>
                <div className="wp-card p-5 lg:col-span-2">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={17} /> Subscription revenue by plan</h3>
                    <div className="overflow-x-auto wp-scroll">
                        <table className="w-full text-sm">
                            <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="pb-2 font-medium">Plan</th><th className="pb-2 font-medium text-right">Price</th><th className="pb-2 font-medium text-right">Subscribers</th><th className="pb-2 font-medium text-right">Monthly</th></tr></thead>
                            <tbody>
                                {(data.revenueByPlan || []).map((p: any) => (
                                    <tr key={p.key} style={{ borderTop: '1px solid var(--card-border)' }}>
                                        <td className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{p.plan}</td>
                                        <td className="py-2 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{p.price === 0 ? 'Free' : inr(p.price)}</td>
                                        <td className="py-2 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{p.subscribers}</td>
                                        <td className="py-2 text-right tabular font-semibold" style={{ color: 'var(--success-600)' }}>{inr(p.monthlyRevenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Stat label="Active" value={data.active} icon={Power} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
                <Stat label="Suspended" value={data.suspended} icon={Power} tone={{ bg: '#fee2e2', fg: 'var(--danger-500)' }} />
                <Stat label="Total GMV" value={inr(data.gmv)} icon={IndianRupee} tone={{ bg: '#dcfce7', fg: 'var(--success-600)' }} />
            </div>
        </div>
    );
}
