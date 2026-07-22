'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Truck, CheckCircle2, PackageCheck, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';

const columns = [
    { key: 'pending', label: 'Pending', icon: Clock, next: 'confirmed', action: 'Confirm' },
    { key: 'confirmed', label: 'Confirmed', icon: PackageCheck, next: 'dispatched', action: 'Dispatch' },
    { key: 'dispatched', label: 'Dispatched', icon: Truck, next: 'delivered', action: 'Mark delivered' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, next: null, action: null },
];

export default function DispatchPage() {
    const qc = useQueryClient();
    const [active, setActive] = useState('pending');
    const { data: orders } = useQuery({ queryKey: ['dispatch-orders'], queryFn: async () => (await api.get('/wholesaler/orders?limit=100')).data.data.items });

    const advance = useMutation({
        mutationFn: async ({ id, status }: any) => (await api.patch(`/wholesaler/orders/${id}/status`, { status })).data.data,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['dispatch-orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    });

    const byStatus = (s: string) => (orders || []).filter((o: any) => o.status === s);
    const col = columns.find((c) => c.key === active)!;
    const list = byStatus(active);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dispatch & Delivery</h1>

            {/* single-line status tabs */}
            <div className="grid grid-cols-4 gap-2">
                {columns.map((c) => {
                    const Icon = c.icon;
                    const n = byStatus(c.key).length;
                    const on = active === c.key;
                    return (
                        <button key={c.key} onClick={() => setActive(c.key)} className="wp-card p-3 text-center transition-all"
                            style={on ? { borderColor: 'var(--brand-600)', boxShadow: '0 0 0 1px var(--brand-600)' } : {}}>
                            <Icon size={17} className="mx-auto mb-1" style={{ color: on ? 'var(--brand-700)' : 'var(--text-muted)' }} />
                            <p className="text-lg font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>{n}</p>
                            <p className="text-[11px] sm:text-xs mt-1 truncate" style={{ color: on ? 'var(--brand-700)' : 'var(--text-secondary)' }}>{c.label}</p>
                        </button>
                    );
                })}
            </div>

            {/* selected status orders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.length === 0 && <p className="col-span-full text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>No {col.label.toLowerCase()} orders.</p>}
                {list.map((o: any) => (
                    <motion.div key={o._id} layout className="wp-card p-4">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.dealerName} · {o.items.length} items</p>
                        <p className="text-lg font-extrabold tabular mt-1" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p>
                        {col.next && (
                            <button className="wp-btn wp-btn-primary w-full mt-2 !py-1.5 !text-xs" disabled={advance.isPending}
                                onClick={() => advance.mutate({ id: o._id, status: col.next })}>{col.action} →</button>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
