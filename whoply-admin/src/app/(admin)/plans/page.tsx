'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Pencil, Trash2, Star, Check, X, Users } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const empty = { key: '', name: '', price: '', period: 'month', highlight: false, order: 0, features: [''] };

export default function PlansPage() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);

    const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/admin/plans')).data.data });

    const openNew = () => { setEditing(null); setForm(empty); setErr(''); setModal(true); };
    const openEdit = (p: any) => { setEditing(p); setForm({ key: p.key, name: p.name, price: p.price, period: p.period, highlight: p.highlight, order: p.order, features: p.features.length ? p.features : [''] }); setErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            const body = { ...form, price: Number(form.price) || 0, order: Number(form.order) || 0, features: form.features.filter((f: string) => f.trim()) };
            if (editing) return (await api.patch(`/admin/plans/${editing._id}`, body)).data.data;
            return (await api.post('/admin/plans', body)).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['plans'] }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/admin/plans/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['plans'] }); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });
    const toggleActive = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/plans/${id}`, { isActive })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
    });

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const setFeature = (i: number, v: string) => setForm((f: any) => ({ ...f, features: f.features.map((x: string, k: number) => (k === i ? v : x)) }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Subscription Plans</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> Add Plan</button>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>These plans appear live on the marketing site’s pricing section.</p>

            <div className="grid md:grid-cols-3 gap-4 items-start">
                {(plans || []).map((p: any) => (
                    <div key={p._id} className="wp-card p-6 relative" style={p.highlight ? { borderColor: 'var(--brand-700)', boxShadow: 'var(--shadow-md)' } : { opacity: p.isActive ? 1 : 0.55 }}>
                        {p.highlight && <span className="wp-chip absolute -top-3 left-6" style={{ background: 'var(--accent-500)', color: '#1a1205' }}><Star size={11} /> Popular</span>}
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                            <div className="flex gap-1">
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(p)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(p)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                        </div>
                        <p className="mt-1"><span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{p.price === 0 ? '₹0' : inr(p.price)}</span><span style={{ color: 'var(--text-muted)' }}>/{p.period}</span></p>
                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Users size={12} /> {p.subscribers} subscriber(s)</p>
                        <ul className="mt-4 space-y-1.5">
                            {p.features.map((f: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><Check size={14} style={{ color: 'var(--success-600)' }} /> {f}</li>
                            ))}
                        </ul>
                        <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={p.isActive} onChange={(e) => toggleActive.mutate({ id: p._id, isActive: e.target.checked })} /> Visible on site
                        </label>
                    </div>
                ))}
            </div>

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit plan' : 'Add plan'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name || !form.key} onClick={() => save.mutate()}>{editing ? 'Save changes' : 'Add plan'}</button>}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Key (unique)"><input className="wp-input" value={form.key} onChange={(e) => set('key', e.target.value.toLowerCase())} disabled={!!editing} placeholder="e.g. pro" /></Field>
                    <Field label="Name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Pro" /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Price ₹"><input className="wp-input tabular" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
                    <Field label="Period"><select className="wp-input" value={form.period} onChange={(e) => set('period', e.target.value)}><option value="month">month</option><option value="year">year</option></select></Field>
                    <Field label="Order"><input className="wp-input tabular" type="number" value={form.order} onChange={(e) => set('order', e.target.value)} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.highlight} onChange={(e) => set('highlight', e.target.checked)} /> Mark as “Most popular”
                </label>
                <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Features</p>
                <div className="space-y-2">
                    {form.features.map((f: string, i: number) => (
                        <div key={i} className="flex gap-2">
                            <input className="wp-input" value={f} onChange={(e) => setFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} />
                            <button className="wp-btn wp-btn-ghost !px-2.5" onClick={() => set('features', form.features.filter((_: any, k: number) => k !== i))}><X size={15} /></button>
                        </div>
                    ))}
                </div>
                <button className="wp-btn wp-btn-ghost text-sm mt-2" onClick={() => set('features', [...form.features, ''])}><Plus size={14} /> Add feature</button>
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title="Delete plan?" message={`Delete the “${del?.name}” plan? Businesses on it must be moved first.`} />
        </div>
    );
}
