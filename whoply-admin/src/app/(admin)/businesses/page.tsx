'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Building2, Search } from 'lucide-react';
import { api } from '@/lib/api';

const planColors: Record<string, any> = {
    free: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    pro: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    business: { background: '#fef3c7', color: 'var(--accent-600)' },
};

export default function BusinessesPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const { data } = useQuery({
        queryKey: ['admin-businesses', search],
        queryFn: async () => (await api.get(`/admin/businesses?limit=100&search=${encodeURIComponent(search)}`)).data.data.items,
    });

    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/businesses/${id}`, { isActive })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-businesses'] }),
    });

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Businesses</h1>
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="wp-input pl-10" placeholder="Search businesses…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm">
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Business</th><th className="p-3 font-medium">Type</th>
                            <th className="p-3 font-medium">GSTIN</th><th className="p-3 font-medium text-right">Products</th>
                            <th className="p-3 font-medium text-right">Invoices</th><th className="p-3 font-medium">Plan</th>
                            <th className="p-3 font-medium text-right">Status</th>
                        </tr></thead>
                        <tbody>
                            {(data || []).map((b: any) => (
                                <tr key={b._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 grid place-items-center rounded-lg" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
                                                {b.type === 'wholesale' ? <Building2 size={15} /> : <Store size={15} />}
                                            </div>
                                            <div><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.city || '—'}</p></div>
                                        </div>
                                    </td>
                                    <td className="p-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{b.type}</td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{b.gstin || '—'}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{b.productCount}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{b.invoiceCount}</td>
                                    <td className="p-3"><span className="wp-chip capitalize" style={planColors[b.plan]}>{b.plan}</span></td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => toggle.mutate({ id: b._id, isActive: !b.isActive })} className="wp-chip"
                                            style={b.isActive ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fee2e2', color: 'var(--danger-500)' }}>
                                            {b.isActive ? 'Active' : 'Suspended'}
                                        </button>
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
