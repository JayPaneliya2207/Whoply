'use client';
import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';

export default function PurchasesPage() {
    const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get('/shopkeeper/suppliers')).data.data });
    const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: async () => (await api.get('/shopkeeper/purchases?limit=30')).data.data.items });

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Suppliers & Purchases</h1>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(suppliers || []).map((s: any) => (
                    <div key={s._id} className="wp-card wp-card-hover p-4 flex items-center gap-3">
                        <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><Truck size={18} /></div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.mobile || 'No contact'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Payable</p>
                            <p className="font-bold tabular" style={{ color: s.payableBalance > 0 ? 'var(--accent-600)' : 'var(--success-600)' }}>{inr2(s.payableBalance)}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="wp-card overflow-hidden">
                <div className="p-4 font-bold" style={{ color: 'var(--text-primary)' }}>Purchase orders</div>
                <table className="w-full text-sm">
                    <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                        <th className="p-3 font-medium">PO No.</th><th className="p-3 font-medium">Supplier</th>
                        <th className="p-3 font-medium text-right">Total</th><th className="p-3 font-medium text-right">Status</th>
                    </tr></thead>
                    <tbody>
                        {(purchases || []).length === 0 && <tr><td colSpan={4} className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>No purchase orders yet.</td></tr>}
                        {(purchases || []).map((p: any) => (
                            <tr key={p._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.poNo}</td>
                                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{p.supplierName}</td>
                                <td className="p-3 text-right tabular" style={{ color: 'var(--text-primary)' }}>{inr2(p.total)}</td>
                                <td className="p-3 text-right capitalize" style={{ color: 'var(--text-secondary)' }}>{p.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
