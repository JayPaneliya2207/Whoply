'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Building2, Search, Plus, Eye, Power, Pencil, Package, Receipt, Users, X } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { PhoneInput } from '@/components/PhoneInput';

const planColors: Record<string, any> = {
    free: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    pro: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    business: { background: '#fef3c7', color: 'var(--accent-600)' },
};
const emptyBiz = { name: '', type: 'retail', ownerName: '', mobile: '', country: '+91', plan: 'free', gstin: '', city: '', password: '' };

export default function BusinessesPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(emptyBiz);
    const [err, setErr] = useState('');
    const [detailId, setDetailId] = useState<string | null>(null);

    const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/admin/plans')).data.data });
    const { data } = useQuery({
        queryKey: ['admin-businesses', search],
        queryFn: async () => (await api.get(`/admin/businesses?limit=100&search=${encodeURIComponent(search)}`)).data.data.items,
    });
    const { data: detail } = useQuery({ queryKey: ['biz-detail', detailId], queryFn: async () => (await api.get(`/admin/businesses/${detailId}`)).data.data, enabled: !!detailId });

    const openNew = () => { setEditing(null); setForm(emptyBiz); setErr(''); setModal(true); };
    const openEdit = (b: any) => { setEditing(b); setForm({ name: b.name, type: b.type, ownerName: b.ownerName, mobile: b.mobile, country: b.countryCode || '+91', plan: b.plan, gstin: b.gstin || '', city: b.city || '', password: '' }); setErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            if (editing) return (await api.patch(`/admin/businesses/${editing._id}`, { name: form.name, ownerName: form.ownerName, plan: form.plan, gstin: form.gstin, city: form.city })).data.data;
            const { country, ...rest } = form;
            return (await api.post('/admin/businesses', { ...rest, countryCode: country })).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['admin-businesses'] }); qc.invalidateQueries({ queryKey: ['plans'] }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/businesses/${id}`, { isActive })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-businesses'] }),
    });
    const changePlan = useMutation({
        mutationFn: async ({ id, plan }: any) => (await api.patch(`/admin/businesses/${id}`, { plan })).data.data,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-businesses'] }); qc.invalidateQueries({ queryKey: ['plans'] }); },
    });
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Businesses</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> Add Business</button>
            </div>
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="wp-input pl-11" placeholder="Search businesses…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 760 }}>
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Business</th><th className="p-3 font-medium">Type</th>
                            <th className="p-3 font-medium text-right">Products</th><th className="p-3 font-medium text-right">Invoices</th>
                            <th className="p-3 font-medium">Plan</th><th className="p-3 font-medium text-right">Status</th><th className="p-3 font-medium text-right">Actions</th>
                        </tr></thead>
                        <tbody>
                            {(data || []).map((b: any) => (
                                <tr key={b._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 grid place-items-center rounded-lg" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}>{b.type === 'wholesale' ? <Building2 size={15} /> : <Store size={15} />}</div>
                                            <div><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.ownerName} · {b.city || '—'}</p></div>
                                        </div>
                                    </td>
                                    <td className="p-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{b.type}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{b.productCount}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{b.invoiceCount}</td>
                                    <td className="p-3">
                                        <select value={b.plan} onChange={(e) => changePlan.mutate({ id: b._id, plan: e.target.value })} className="wp-chip capitalize border-0 outline-none cursor-pointer" style={planColors[b.plan] || planColors.free}>
                                            {(plans || []).map((p: any) => <option key={p.key} value={p.key}>{p.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => toggle.mutate({ id: b._id, isActive: !b.isActive })} className="wp-chip" style={b.isActive ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fee2e2', color: 'var(--danger-500)' }}>
                                            <Power size={11} /> {b.isActive ? 'Active' : 'Suspended'}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDetailId(b._id)}><Eye size={14} /></button>
                                            <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit business' : 'Add business'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name || !form.ownerName || (!editing && !form.mobile)} onClick={() => save.mutate()}>{editing ? 'Save changes' : 'Create business'}</button>}>
                <Field label="Business name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
                <Field label="Owner name"><input className="wp-input" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="e.g. Rakesh Sharma" /></Field>
                <Field label="Owner mobile"><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(c) => set('country', c)} disabled={!!editing} /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Type"><select className="wp-input" value={form.type} onChange={(e) => set('type', e.target.value)} disabled={!!editing}><option value="retail">Retail (Shopkeeper)</option><option value="wholesale">Wholesale</option></select></Field>
                    <Field label="Plan"><select className="wp-input" value={form.plan} onChange={(e) => set('plan', e.target.value)}>{(plans || []).map((p: any) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="GSTIN"><input className="wp-input uppercase" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" maxLength={15} /></Field>
                    <Field label="City"><input className="wp-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Surat" /></Field>
                </div>
                {!editing && <Field label="Owner password (optional)"><input className="wp-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="They can also login via OTP" /></Field>}
                {err && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            {/* Detail */}
            <Modal open={!!detailId} onClose={() => setDetailId(null)} title={detail?.business?.name || 'Business'}>
                {detail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="wp-card p-3"><Package size={16} className="mx-auto mb-1" style={{ color: 'var(--brand-700)' }} /><p className="font-bold" style={{ color: 'var(--text-primary)' }}>{detail.products}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Products</p></div>
                            <div className="wp-card p-3"><Receipt size={16} className="mx-auto mb-1" style={{ color: 'var(--brand-700)' }} /><p className="font-bold" style={{ color: 'var(--text-primary)' }}>{detail.invoices}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Invoices</p></div>
                            <div className="wp-card p-3"><Users size={16} className="mx-auto mb-1" style={{ color: 'var(--brand-700)' }} /><p className="font-bold" style={{ color: 'var(--text-primary)' }}>{detail.staffCount}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff</p></div>
                        </div>
                        <div className="wp-card p-3 text-center"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lifetime GMV</p><p className="text-xl font-extrabold tabular" style={{ color: 'var(--success-600)' }}>{inr(detail.gmv)}</p></div>
                        <div>
                            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Users ({detail.users.length})</p>
                            <div className="space-y-1.5">
                                {detail.users.map((u: any) => (
                                    <div key={u._id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                                        <div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.mobile}</p></div>
                                        <span className="wp-chip capitalize" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{u.role}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
