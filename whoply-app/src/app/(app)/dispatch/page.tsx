'use client';
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
    const { data: orders } = useQuery({ queryKey: ['dispatch-orders'], queryFn: async () => (await api.get('/wholesaler/orders?limit=100')).data.data.items });

    const advance = useMutation({
        mutationFn: async ({ id, status }: any) => (await api.patch(`/wholesaler/orders/${id}/status`, { status })).data.data,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['dispatch-orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    });

    const byStatus = (s: string) => (orders || []).filter((o: any) => o.status === s);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dispatch & Delivery</h1>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                {columns.map((col) => {
                    const Icon = col.icon;
                    const list = byStatus(col.key);
                    return (
                        <div key={col.key} className="wp-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Icon size={17} style={{ color: 'var(--brand-700)' }} />
                                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{col.label}</h3>
                                <span className="wp-chip ml-auto" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{list.length}</span>
                            </div>
                            <div className="space-y-2">
                                {list.length === 0 && <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>No orders</p>}
                                {list.map((o: any) => (
                                    <motion.div key={o._id} layout className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.dealerName} · {o.items.length} items</p>
                                        <p className="text-sm font-bold tabular mt-1" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p>
                                        {col.next && (
                                            <button className="wp-btn wp-btn-primary w-full mt-2 !py-1.5 !text-xs" disabled={advance.isPending}
                                                onClick={() => advance.mutate({ id: o._id, status: col.next })}>{col.action} →</button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
