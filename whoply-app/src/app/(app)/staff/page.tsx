'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, Trash2, BadgeCheck, ShieldAlert, Wallet, IdCard, Upload, X, Camera } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { kycPlaceholder, formatKyc } from '@/lib/forms';
import { useT } from '@/i18n';

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

const empty = { name: '', mobile: '', country: '+91', role: 'cashier', salary: '', password: '', kycDoc: 'aadhaar', kycNumber: '', kycVerified: false, kycDocs: [] as string[] };
const MAX_DOCS = 5;

export default function StaffPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const t = useT();
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
        setForm({ name: s.name, mobile: s.mobile, country: s.countryCode || '+91', role: s.role, salary: s.salary || '', password: '', kycDoc: s.kyc?.docType || 'aadhaar', kycNumber: s.kyc?.docNumber || '', kycVerified: s.kyc?.verified || false, kycDocs: s.kyc?.documents || [] });
        setErr(''); setModal(true);
    };

    // Downscale each uploaded doc image to a small data URL; cap at MAX_DOCS.
    const addDocs = (files?: FileList | null) => {
        if (!files) return;
        const room = MAX_DOCS - form.kycDocs.length;
        Array.from(files).slice(0, room).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const max = 900;
                    const scale = Math.min(1, max / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    setForm((f: any) => (f.kycDocs.length >= MAX_DOCS ? f : { ...f, kycDocs: [...f.kycDocs, canvas.toDataURL('image/jpeg', 0.8)] }));
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        });
    };
    const removeDoc = (i: number) => setForm((f: any) => ({ ...f, kycDocs: f.kycDocs.filter((_: string, idx: number) => idx !== i) }));

    const save = useMutation({
        mutationFn: async () => {
            const kyc = { docType: form.kycDoc, docNumber: form.kycNumber, verified: form.kycVerified, documents: form.kycDocs };
            if (editing) return (await api.patch(`/staff/${editing._id}`, { name: form.name, role: form.role, salary: Number(form.salary) || 0, kyc })).data.data;
            return (await api.post('/staff', { name: form.name, mobile: form.mobile, countryCode: form.country, role: form.role, salary: Number(form.salary) || 0, kyc, password: form.password || undefined })).data.data;
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
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('staff')}</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><UserPlus size={16} /> {t('addStaffTitle')}</button>
            </div>

            {/* Salary summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><UserPlus size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalStaff')}</p><p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{data?.count || 0}</p></div>
                </div>
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: '#fef3c7', color: 'var(--accent-600)' }}><Wallet size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('monthlySalaryLabel')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(data?.monthlySalary || 0)}</p></div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                {(s.kyc?.docNumber || s.kyc?.documents?.length) ? (
                                    <span className="wp-chip" style={s.kyc.verified ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: '#fef3c7', color: 'var(--accent-600)' }}>
                                        {s.kyc.verified ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />} KYC
                                    </span>
                                ) : <span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{t('noKyc')}</span>}
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(s)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                        </div>
                        {(s.kyc?.docNumber || s.kyc?.documents?.length > 0) && (
                            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <IdCard size={12} /> {DOC_LABELS[s.kyc.docType] || 'Doc'}{s.kyc?.docNumber ? `: ${s.kyc.docNumber}` : ''}{s.kyc?.documents?.length > 0 ? ` · ${s.kyc.documents.length} file${s.kyc.documents.length > 1 ? 's' : ''}` : ''}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('editStaffTitle') : t('addStaffTitle')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name || (!editing && !form.mobile)} onClick={() => save.mutate()}>{editing ? t('save') : t('addStaffTitle')}</button>}>
                <Field label={t('fullName')}><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Anita Desai" autoFocus /></Field>
                <Field label="Mobile"><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(c) => set('country', c)} disabled={!!editing} /></Field>
                <Field label={t('roleLabel')}><select className="wp-input" value={form.role} onChange={(e) => set('role', e.target.value)}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
                <Field label={t('salaryMonthRs')}><input className="wp-input tabular" type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} placeholder="0" /></Field>
                {!editing && <Field label={t('loginPasswordOptional')}><input className="wp-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="They can also login via OTP" /></Field>}

                <div className="rounded-xl p-3 mt-1" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><IdCard size={15} /> {t('kycDocument')} <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(optional)</span></p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('documentLabel')}><select className="wp-input" value={form.kycDoc} onChange={(e) => { const dt = e.target.value; setForm((f: any) => ({ ...f, kycDoc: dt, kycNumber: formatKyc(dt, f.kycNumber) })); }}>{Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                        <Field label={t('numberLabel')}><input className="wp-input" inputMode={form.kycDoc === 'aadhaar' ? 'numeric' : 'text'} value={form.kycNumber} onChange={(e) => set('kycNumber', formatKyc(form.kycDoc, e.target.value))} placeholder={kycPlaceholder(form.kycDoc)} /></Field>
                    </div>

                    {/* Document upload — up to 5 */}
                    <div className="mb-2">
                        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('uploadDocuments')} ({form.kycDocs.length}/{MAX_DOCS})</p>
                        <div className="flex flex-wrap gap-2">
                            {form.kycDocs.map((d: string, i: number) => (
                                <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                                    <img src={d} alt={`doc ${i + 1}`} className="h-full w-full object-cover" />
                                    <button type="button" onClick={() => removeDoc(i)} className="absolute -top-1.5 -right-1.5 h-5 w-5 grid place-items-center rounded-full" style={{ background: 'var(--danger-500)', color: '#fff' }}><X size={11} /></button>
                                </div>
                            ))}
                            {form.kycDocs.length < MAX_DOCS && (
                                <>
                                    <label className="h-14 w-14 rounded-lg grid place-items-center cursor-pointer" title={t('uploadFromGallery')} style={{ border: '1px dashed var(--card-border)', color: 'var(--text-muted)' }}>
                                        <Upload size={16} />
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addDocs(e.target.files); e.target.value = ''; }} />
                                    </label>
                                    <label className="h-14 w-14 rounded-lg grid place-items-center cursor-pointer" title={t('takePhoto')} style={{ border: '1px dashed var(--card-border)', color: 'var(--text-muted)' }}>
                                        <Camera size={16} />
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addDocs(e.target.files); e.target.value = ''; }} />
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={form.kycVerified} onChange={(e) => set('kycVerified', e.target.checked)} /> {t('markKycVerified')}
                    </label>
                </div>
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('removeStaffTitle')} message={`Remove “${del?.name}” from your staff?`} />
        </div>
    );
}
