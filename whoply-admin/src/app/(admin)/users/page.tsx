'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, Search } from 'lucide-react';
import { api, apiErr } from '@/lib/api';

const roleColors: Record<string, any> = {
    owner: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    admin: { background: 'var(--warning-tint)', color: 'var(--warning)' },
    manager: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    cashier: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    warehouse: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    salesStaff: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    accountant: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function UsersPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [q, setQ] = useState(''); // the search actually sent, a moment after typing stops
    const [page, setPage] = useState(1);
    useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);
    const { data } = useQuery({
        queryKey: ['admin-users', q, page],
        queryFn: async () => (await api.get(`/admin/users?limit=50&page=${page}&search=${encodeURIComponent(q)}`)).data.data,
        placeholderData: (prev) => prev,
    });
    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/users/${id}`, { isActive })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
        onError: (e) => alert(apiErr(e)),
    });
    const filtered = data?.items || [];
    const meta = data?.meta;
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
                                            <div className="h-8 w-8 grid place-items-center rounded-full font-bold text-xs" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{u.name.charAt(0)}</div>
                                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.mobile}</td>
                                    <td className="p-3"><span className="wp-chip capitalize" style={roleColors[u.role] || roleColors.cashier}>{u.role}</span></td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.businessId?.name || '—'}</td>
                                    <td className="p-3 text-right">
                                        {u.role === 'admin' ? (
                                            <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>Active</span>
                                        ) : (
                                            <button onClick={() => toggle.mutate({ id: u._id, isActive: !u.isActive })} className="wp-chip" style={u.isActive ? { background: 'var(--success-tint)', color: 'var(--success)' } : { background: 'var(--danger-tint)', color: 'var(--danger)' }}>
                                                <Power size={11} /> {u.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!filtered.length && <p className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users found.</p>}
            </div>
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>Page {meta.page} of {meta.totalPages} · {meta.total} users</span>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
}
