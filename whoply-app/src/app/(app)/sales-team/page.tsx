'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Route, MapPin, IndianRupee, Plus, Pencil, Trash2, IdCard, BadgeCheck, ShieldAlert, ShoppingBag, ChevronRight } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const outcomeTone: Record<string, any> = {
    order: { background: '#dcfce7', color: 'var(--success-600)' },
    no_order: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    follow_up: { background: '#fef3c7', color: 'var(--accent-600)' },
};
const statusTone: Record<string, any> = {
    pending: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    confirmed: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    dispatched: { background: '#fef3c7', color: 'var(--accent-600)' },
    delivered: { background: '#dcfce7', color: 'var(--success-600)' },
};
const DOC_LABELS: Record<string, string> = { aadhaar: 'Aadhaar', pan: 'PAN', voterid: 'Voter ID', driving: 'Driving Licence', other: 'Other' };
const empty = { name: '', mobile: '', salary: '', password: '', kycDoc: 'aadhaar', kycNumber: '', kycVerified: false };

export default function SalesTeamPage() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'visits' | 'orders'>('visits');

    const { data: reps } = useQuery({ queryKey: ['reps'], queryFn: async () => (await api.get('/wholesaler/sales-team')).data.data });
    const { data: visits } = useQuery({ queryKey: ['visits'], queryFn: async () => (await api.get('/wholesaler/sales-team/visits')).data.data });
    const { data: detail } = useQuery({ queryKey: ['staff-detail', detailId], queryFn: async () => (await api.get(`/staff/${detailId}/detail`)).data.data, enabled: !!detailId });

    const openNew = () => { setEditing(null); setForm(empty); setErr(''); setModal(true); };
    const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name, mobile: r.mobile, salary: '', password: '', kycDoc: 'aadhaar', kycNumber: '', kycVerified: false }); setErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            const kyc = { docType: form.kycDoc, docNumber: form.kycNumber, verified: form.kycVerified };
            if (editing) return (await api.patch(`/wholesaler/sales-team/${editing._id}`, { name: form.name })).data.data;
            return (await api.post('/wholesaler/sales-team', { name: form.name, mobile: form.mobile, salary: Number(form.salary) || 0, kyc, password: form.password || undefined })).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['reps'] }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/wholesaler/sales-team/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['reps'] }); },
    });
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    const activeRep = (reps || []).find((r: any) => r._id === detailId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sales Team</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> Add Rep</button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(reps || []).map((r: any) => (
                    <div key={r._id} className="wp-card wp-card-hover p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-11 w-11 grid place-items-center rounded-full font-bold" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{r.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0"><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.mobile}</p></div>
                            <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                            <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(r)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                        </div>
                        {/* clickable stats → open detail */}
                        <button className="grid grid-cols-3 gap-2 text-center w-full" onClick={() => { setDetailId(r._id); setDetailTab('visits'); }}>
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}><p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{r.visits}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Visits</p></div>
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}><p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{r.orders}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Orders</p></div>
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}><p className="text-lg font-extrabold" style={{ color: 'var(--success-600)' }}>{inr2(r.commission)}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Comm.</p></div>
                        </button>
                        <button className="text-sm mt-3 flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-700)' }} onClick={() => { setDetailId(r._id); setDetailTab('orders'); }}>
                            <IndianRupee size={13} /> {inr2(r.sales)} sales · view detail <ChevronRight size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="wp-card p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><MapPin size={17} /> Recent field visits</h3>
                <div className="space-y-2">
                    {(visits || []).length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No visits recorded yet.</p>}
                    {(visits || []).map((v: any) => (
                        <div key={v._id} className="flex items-center gap-3 py-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <Route size={15} style={{ color: 'var(--text-muted)' }} />
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.salesRepName} → {v.dealerName}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(v.visitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {v.note}</p></div>
                            <span className="wp-chip capitalize" style={outcomeTone[v.outcome]}>{v.outcome.replace('_', ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit rep */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit sales rep' : 'Add sales rep'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name || (!editing && !form.mobile)} onClick={() => save.mutate()}>{editing ? 'Save' : 'Add rep'}</button>}>
                <Field label="Name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sunil Yadav" autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Mobile"><input className="wp-input" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} disabled={!!editing} placeholder="10-digit" /></Field>
                    <Field label="Monthly salary ₹"><input className="wp-input tabular" type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} placeholder="0" disabled={!!editing} /></Field>
                </div>
                {!editing && (
                    <>
                        <Field label="Login password (optional)"><input className="wp-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="They can also login via OTP" /></Field>
                        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><IdCard size={15} /> KYC document</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Document"><select className="wp-input" value={form.kycDoc} onChange={(e) => set('kycDoc', e.target.value)}>{Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                                <Field label="Number"><input className="wp-input" value={form.kycNumber} onChange={(e) => set('kycNumber', e.target.value)} placeholder="Doc number" /></Field>
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={form.kycVerified} onChange={(e) => set('kycVerified', e.target.checked)} /> Mark KYC as verified</label>
                        </div>
                    </>
                )}
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            {/* Rep detail */}
            <Modal open={!!detailId} onClose={() => setDetailId(null)} title={activeRep?.name || 'Sales rep'}>
                {detail?.staff?.kyc?.docNumber && (
                    <div className="wp-card p-3 mb-3 flex items-center justify-between" style={{ background: 'var(--surface-2)' }}>
                        <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><IdCard size={14} /> {DOC_LABELS[detail.staff.kyc.docType]}: {detail.staff.kyc.docNumber}</span>
                        <span className="wp-chip" style={detail.staff.kyc.verified ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' }}>{detail.staff.kyc.verified ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />} KYC</span>
                    </div>
                )}
                <div className="flex gap-1 p-1 rounded-xl mb-3" style={{ background: 'var(--surface-2)' }}>
                    {(['visits', 'orders'] as const).map((tb) => (
                        <button key={tb} onClick={() => setDetailTab(tb)} className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize" style={detailTab === tb ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>{tb} ({tb === 'visits' ? detail?.visits?.length || 0 : detail?.orders?.length || 0})</button>
                    ))}
                </div>
                {detailTab === 'visits' && (
                    <div className="space-y-2">
                        {(detail?.visits || []).length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No visits.</p>}
                        {(detail?.visits || []).map((v: any) => (
                            <div key={v._id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                                <div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.dealerName}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(v.visitedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p></div>
                                <span className="wp-chip capitalize" style={outcomeTone[v.outcome]}>{v.outcome.replace('_', ' ')}</span>
                            </div>
                        ))}
                    </div>
                )}
                {detailTab === 'orders' && (
                    <div className="space-y-2">
                        {(detail?.orders || []).length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No orders.</p>}
                        {(detail?.orders || []).map((o: any) => (
                            <div key={o._id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                                <div className="flex items-center gap-2"><ShoppingBag size={14} style={{ color: 'var(--text-muted)' }} /><div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.dealerName}</p></div></div>
                                <div className="text-right"><p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p><span className="wp-chip capitalize" style={statusTone[o.status]}>{o.status}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title="Remove sales rep?" message={`Remove “${del?.name}” from the team?`} />
        </div>
    );
}
