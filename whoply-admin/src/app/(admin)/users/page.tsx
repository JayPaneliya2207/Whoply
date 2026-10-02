'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, Power, Store, Layers, ShieldCheck } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', warehouse: 'Warehouse', salesStaff: 'Sales rep', accountant: 'Accountant', admin: 'Platform admin' };
const ROLE_TONE: Record<string, React.CSSProperties> = {
    owner: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    admin: { background: 'var(--warning-tint)', color: 'var(--warning)' },
    manager: { background: 'var(--accent-tint)', color: 'var(--accent-strong)' },
    staff: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};
/** Same rule as the API (utils/permissions.ts staffRolesFor). */
const staffRolesFor = (type?: string) => (type === 'wholesale' ? ['manager', 'warehouse', 'salesStaff', 'accountant'] : ['manager', 'cashier', 'accountant']);
const empty = { businessId: '', name: '', mobile: '', country: '+91', role: 'cashier', password: '', isActive: true };
const when = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Never');

export default function UsersPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [q, setQ] = useState(''); // the search actually sent, a moment after typing stops
    const [role, setRole] = useState('');
    const [biz, setBiz] = useState('');
    const [active, setActive] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

    const params = new URLSearchParams({ limit: '50', page: String(page), search: q, role, businessId: biz, active }).toString();
    const { data, isFetching } = useQuery({
        queryKey: ['admin-users', params],
        queryFn: async () => (await api.get(`/admin/users?${params}`)).data.data,
        placeholderData: (prev) => prev,
    });
    const { data: businesses } = useQuery({ queryKey: ['admin-businesses-lite'], queryFn: async () => (await api.get('/admin/businesses?lite=1&limit=100')).data.data.items as any[] });
    const bizType = (id: string) => (businesses || []).find((b: any) => b._id === id)?.type;

    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);
    const [flash, setFlash] = useState('');
    const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 5000); };
    const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] });
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    const openNew = () => { setEditing(null); setForm({ ...empty, businessId: biz, role: staffRolesFor(bizType(biz))[0] }); setErr(''); setModal(true); };
    const openEdit = (u: any) => { setEditing(u); setForm({ businessId: u.businessId?._id || '', name: u.name, mobile: u.mobile, country: u.countryCode || '+91', role: u.role, password: '', isActive: u.isActive }); setErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            if (editing) {
                const body: any = { name: form.name, isActive: form.isActive };
                if (editing.role !== 'owner') body.role = form.role;
                if (form.mobile !== editing.mobile || form.country !== (editing.countryCode || '+91')) { body.mobile = form.mobile; body.countryCode = form.country; }
                if (form.password) body.password = form.password;
                return (await api.patch(`/admin/users/${editing._id}`, body)).data;
            }
            return (await api.post('/admin/users', { businessId: form.businessId, name: form.name, mobile: form.mobile, countryCode: form.country, role: form.role, password: form.password || undefined })).data;
        },
        onSuccess: (r) => { setModal(false); refresh(); say(r.message || 'Saved'); },
        onError: (e) => setErr(apiErr(e)),
    });
    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/users/${id}`, { isActive })).data,
        onSuccess: refresh,
        onError: (e) => alert(apiErr(e)),
    });
    const remove = useMutation({
        mutationFn: async () => (await api.delete(`/admin/users/${del._id}`)).data,
        onSuccess: (r) => { setDel(null); refresh(); say(r.message || 'Deleted'); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });

    const items: any[] = data?.items || [];
    const meta = data?.meta;
    const roleOptions = editing ? staffRolesFor(editing.businessId?.type) : staffRolesFor(bizType(form.businessId));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Users</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{meta ? `${meta.total} ${meta.total === 1 ? 'login' : 'logins'}` : ' '}{isFetching ? ' · updating…' : ''}</p>
                </div>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> Add user</button>
            </div>
            {flash && <div className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>{flash}</div>}

            {/* Filters */}
            <div className="wp-card p-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_11rem_14rem_9rem]">
                <div className="relative sm:col-span-2 xl:col-span-1">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input className="wp-input pl-11" placeholder="Search by name or mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="wp-input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
                    <option value="">All roles</option>
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="wp-input" value={biz} onChange={(e) => { setBiz(e.target.value); setPage(1); }} aria-label="Business">
                    <option value="">All businesses</option>
                    {(businesses || []).map((b: any) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
                <select className="wp-input" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Status">
                    <option value="">Any status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>

            {/* Table */}
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 860 }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left whitespace-nowrap">
                                <th className="p-3 font-medium">User</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Business</th>
                                <th className="p-3 font-medium">Last login</th><th className="p-3 font-medium">Joined</th>
                                <th className="p-3 font-medium text-right">Status</th><th className="p-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((u) => {
                                const isAdmin = u.role === 'admin';
                                const isOwner = u.role === 'owner';
                                return (
                                    <tr key={u._id} style={{ borderTop: '1px solid var(--card-border)', opacity: u.isActive ? 1 : 0.7 }}>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 grid place-items-center rounded-full font-bold text-xs shrink-0" style={isAdmin ? { background: 'var(--warning-tint)', color: 'var(--warning)' } : { background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{u.name.charAt(0).toUpperCase()}</div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                                                    <p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{u.countryCode && u.countryCode !== '+91' ? `${u.countryCode} ` : ''}{u.mobile}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3"><span className="wp-chip whitespace-nowrap" style={ROLE_TONE[u.role] || ROLE_TONE.staff}>{isAdmin && <ShieldCheck size={11} />}{ROLE_LABEL[u.role] || u.role}</span></td>
                                        <td className="p-3">
                                            {u.businessId ? (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span style={{ color: 'var(--text-muted)' }}>{u.businessId.type === 'wholesale' ? <Layers size={14} /> : <Store size={14} />}</span>
                                                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{u.businessId.name}</span>
                                                </div>
                                            ) : <span style={{ color: 'var(--text-muted)' }}>— platform —</span>}
                                        </td>
                                        <td className="p-3 tabular whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{when(u.lastLogin)}</td>
                                        <td className="p-3 tabular whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{when(u.createdAt)}</td>
                                        <td className="p-3 text-right">
                                            {isAdmin ? (
                                                <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>Active</span>
                                            ) : (
                                                <button onClick={() => toggle.mutate({ id: u._id, isActive: !u.isActive })} className="wp-chip whitespace-nowrap" title={u.isActive ? 'Turn this login off' : 'Turn this login on'}
                                                    style={u.isActive ? { background: 'var(--success-tint)', color: 'var(--success)' } : { background: 'var(--danger-tint)', color: 'var(--danger)' }}>
                                                    <Power size={11} /> {u.isActive ? 'Active' : 'Inactive'}
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="wp-btn wp-btn-ghost !p-2" title={isAdmin ? 'Admin logins are managed separately' : 'Edit'} disabled={isAdmin} aria-label={`Edit ${u.name}`} onClick={() => openEdit(u)}><Pencil size={14} /></button>
                                                <button className="wp-btn wp-btn-ghost !p-2" title={isAdmin ? 'Admin logins are managed separately' : isOwner ? 'Owners are not deleted — suspend the business instead' : 'Delete'} disabled={isAdmin || isOwner} aria-label={`Delete ${u.name}`} onClick={() => setDel(u)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {!items.length && <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users match these filters.</p>}
            </div>
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>Page {meta.page} of {meta.totalPages} · {meta.total} users</span>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}

            {/* Add / edit */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'Add user'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name.trim() || !form.mobile || (!editing && !form.businessId)} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create login'}</button>}>
                {editing ? (
                    <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        {ROLE_LABEL[editing.role]} at <b style={{ color: 'var(--text-primary)' }}>{editing.businessId?.name || '—'}</b>
                    </div>
                ) : (
                    <Field label="Business">
                        <select className="wp-input" value={form.businessId} autoFocus onChange={(e) => { const v = e.target.value; setForm((f: any) => ({ ...f, businessId: v, role: staffRolesFor(bizType(v))[0] })); }}>
                            <option value="">Choose a business…</option>
                            {(businesses || []).map((b: any) => <option key={b._id} value={b._id}>{b.name} · {b.type === 'wholesale' ? 'Wholesale' : 'Retail'}</option>)}
                        </select>
                    </Field>
                )}
                <Field label="Name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="Full name" /></Field>
                <Field label="Mobile"><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(c) => set('country', c)} /></Field>
                {(!editing || editing.role !== 'owner') && (
                    <Field label="Role">
                        <select className="wp-input" value={form.role} onChange={(e) => set('role', e.target.value)}>
                            {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                    </Field>
                )}
                <Field label={editing ? 'New password (leave empty to keep the current one)' : 'Password (optional — they can also sign in with an OTP)'}>
                    <input className="wp-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
                </Field>
                {editing && (
                    <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Login is active
                    </label>
                )}
                {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} title={`Delete ${del?.name}?`} confirmLabel="Delete login"
                message="Their login stops working right away. If this person made bills, orders or payments, the login is only turned off so those records keep their author." />
        </div>
    );
}
