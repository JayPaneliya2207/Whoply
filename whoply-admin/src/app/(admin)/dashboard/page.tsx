'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, Store, Users, Receipt, IndianRupee, Layers } from 'lucide-react';
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

            <div className="wp-card p-5">
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Subscription plans</h3>
                <div className="grid grid-cols-3 gap-4">
                    {data.plans.map((p: any) => (
                        <div key={p.plan} className="rounded-xl p-4 text-center" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-2xl font-extrabold" style={{ color: 'var(--brand-700)' }}>{p.count}</p>
                            <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{p.plan}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
