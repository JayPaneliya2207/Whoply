'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, Search } from 'lucide-react';
import { api } from '@/lib/api';

const roleColors: Record<string, any> = {
    owner: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    admin: { background: '#fef3c7', color: 'var(--accent-600)' },
    manager: { background: '#e0e7ff', color: 'var(--brand-700)' },
    cashier: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    warehouse: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    salesStaff: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    accountant: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function UsersPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const { data } = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await api.get('/admin/users?limit=200')).data.data.items });
    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/users/${id}`, { isActive })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    });
    const filtered = (data || []).filter((u: any) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.mobile.includes(search));
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Users</h1>
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="wp-input pl-11" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 640 }}>
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Mobile</th>
                            <th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Business</th>
                            <th className="p-3 font-medium text-right">Status</th>
                        </tr></thead>
                        <tbody>
                            {filtered.map((u: any) => (
                                <tr key={u._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 grid place-items-center rounded-full font-bold text-xs" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{u.name.charAt(0)}</div>
                                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.mobile}</td>
                                    <td className="p-3"><span className="wp-chip capitalize" style={roleColors[u.role] || roleColors.cashier}>{u.role}</span></td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.businessId?.name || '—'}</td>
                                    <td className="p-3 text-right">
                                        {u.role === 'admin' ? (
                                            <span className="wp-chip" style={{ background: '#dcfce7', color: 'var(--success-600)' }}>Active</span>
                                        ) : (
                                            <button onClick={() => toggle.mutate({ id: u._id, isActive: !u.isActive })} className="wp-chip" style={u.isActive ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fee2e2', color: 'var(--danger-500)' }}>
                                                <Power size={11} /> {u.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        )}
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
