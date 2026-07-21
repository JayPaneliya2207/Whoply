'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const roleColors: Record<string, any> = {
    owner: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    admin: { background: '#fef3c7', color: 'var(--accent-600)' },
    cashier: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    warehouse: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    salesStaff: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function UsersPage() {
    const { data } = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await api.get('/admin/users?limit=100')).data.data.items });
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Users</h1>
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm">
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Mobile</th>
                            <th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Business</th>
                            <th className="p-3 font-medium text-right">Status</th>
                        </tr></thead>
                        <tbody>
                            {(data || []).map((u: any) => (
                                <tr key={u._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 grid place-items-center rounded-full font-bold text-xs" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{u.name.charAt(0)}</div>
                                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.mobile}</td>
                                    <td className="p-3"><span className="wp-chip" style={roleColors[u.role] || roleColors.cashier}>{u.role}</span></td>
                                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{u.businessId?.name || '—'}</td>
                                    <td className="p-3 text-right"><span className="wp-chip" style={u.isActive ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fee2e2', color: 'var(--danger-500)' }}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
