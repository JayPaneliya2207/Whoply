'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, Trash2, BadgeCheck, ShieldAlert, Wallet, IdCard } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const ROLE_LABELS: Record<string, string> = {
    cashier: 'Cashier', manager: 'Manager', warehouse: 'Warehouse', salesStaff: 'Sales Staff', accountant: 'Accountant',
};
const DOC_LABELS: Record<string, string> = { aadhaar: 'Aadhaar', pan: 'PAN', voterid: 'Voter ID', driving: 'Driving Licence', other: 'Other' };
const roleTone: Record<string, any> = {
    cashier: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    manager: { background: '#fef3c7', color: 'var(--accent-600)' },
    warehouse: { background: '#dcfce7', color: 'var(--success-600)' },
    salesStaff: { background: '#e0e7ff', color: 'var(--brand-700)' },
    accountant: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

const empty = { name: '', mobile: '', role: 'cashier', salary: '', password: '', kycDoc: 'aadhaar', kycNumber: '', kycVerified: false };

export default function StaffPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const isWholesale = user?.business?.type === 'wholesale';
    const roleOptions = isWholesale ? ['warehouse', 'salesStaff', 'manager', 'accountant'] : ['cashier', 'manager', 'accountant'];

    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>({ ...empty, role: roleOptions[0] });
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);

    const { data } = useQuery({ queryKey: ['staff'], queryFn: async () => (await api.get('/staff')).data.data });

    const openNew = () => { setEditing(null); setForm({ ...empty, role: roleOptions[0] }); setErr(''); setModal(true); };
    const openEdit = (s: any) => {
        setEditing(s);
        setForm({ name: s.name, mobile: s.mobile, role: s.role, salary: s.salary || '', password: '', kycDoc: s.kyc?.docType || 'aadhaar', kycNumber: s.kyc?.docNumber || '', kycVerified: s.kyc?.verified || false });
        setErr(''); setModal(true);
    };

    const save = useMutation({
        mutationFn: async () => {
            const kyc = { docType: form.kycDoc, docNumber: form.kycNumber, verified: form.kycVerified };
            if (editing) return (await api.patch(`/staff/${editing._id}`, { name: form.name, role: form.role, salary: Number(form.salary) || 0, kyc })).data.data;
            return (await api.post('/staff', { name: form.name, mobile: form.mobile, role: form.role, salary: Number(form.salary) || 0, kyc, password: form.password || undefined })).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['rep-summary'] }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/staff/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['staff'] }); },
    });
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><UserPlus size={16} /> Add Staff</button>
            </div>

            {/* Salary summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><UserPlus size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total staff</p><p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data?.count || 0}</p></div>
                </div>
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: '#fef3c7', color: 'var(--accent-600)' }}><Wallet size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Monthly salary</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(data?.monthlySalary || 0)}</p></div>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data?.staff || []).map((s: any) => (
                    <div key={s._id} className="wp-card wp-card-hover p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 grid place-items-center rounded-full font-bold" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{s.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.mobile}</p>
                            </div>
                            <span className="wp-chip" style={roleTone[s.role]}>{ROLE_LABELS[s.role]}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Salary / month</p>
                                <p className="font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(s.salary || 0)}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {s.kyc?.docNumber ? (
                                    <span className="wp-chip" style={s.kyc.verified ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' }}>
                                        {s.kyc.verified ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />} KYC
                                    </span>
                                ) : <span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>No KYC</span>}
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(s)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                        </div>
                        {s.kyc?.docNumber && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><IdCard size={12} /> {DOC_LABELS[s.kyc.docType] || 'Doc'}: {s.kyc.docNumber}</p>}
                    </div>
                ))}
            </div>

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit staff' : 'Add staff'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name || (!editing && !form.mobile)} onClick={() => save.mutate()}>{editing ? 'Save changes' : 'Add staff'}</button>}>
                <Field label="Full name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Anita Desai" autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Mobile"><input className="wp-input" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} disabled={!!editing} placeholder="10-digit" /></Field>
                    <Field label="Role"><select className="wp-input" value={form.role} onChange={(e) => set('role', e.target.value)}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
                </div>
                <Field label="Monthly salary ₹"><input className="wp-input tabular" type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} placeholder="0" /></Field>
                {!editing && <Field label="Login password (optional)"><input className="wp-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="They can also login via OTP" /></Field>}

                <div className="rounded-xl p-3 mt-1" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><IdCard size={15} /> KYC document</p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Document"><select className="wp-input" value={form.kycDoc} onChange={(e) => set('kycDoc', e.target.value)}>{Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                        <Field label="Number"><input className="wp-input" value={form.kycNumber} onChange={(e) => set('kycNumber', e.target.value)} placeholder="Doc number" /></Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={form.kycVerified} onChange={(e) => set('kycVerified', e.target.checked)} /> Mark KYC as verified
                    </label>
                </div>
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title="Remove staff?" message={`Remove “${del?.name}” from your staff?`} />
        </div>
    );
}
