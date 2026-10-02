'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Pencil, Trash2, Power, Check, X, History, KeyRound, Users } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';

const ROLE_TONE: Record<string, React.CSSProperties> = {
    super: { background: 'var(--warning-tint)', color: 'var(--warning)' },
    support: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    billing: { background: 'var(--success-tint)', color: 'var(--success)' },
    viewer: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};
/** Plain words for each permission, grouped the way the menu is. */
const PERM_ROWS: [string, string, string][] = [
    ['Dashboard', 'stats.view', ''],
    ['Businesses', 'businesses.view', 'businesses.manage'],
    ['Users', 'users.view', 'users.manage'],
    ['Plans', 'plans.view', 'plans.manage'],
    ['Billing', 'billing.view', 'billing.manage'],
    ['Support chat', 'support.chat', 'support.chat'],
    ['Inquiries', 'inquiries.view', 'inquiries.manage'],
    ['Settings', 'settings.manage', 'settings.manage'],
    ['Admin logins & activity', 'admins.manage', 'admins.manage'],
];
const when = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Never');
const empty = { name: '', mobile: '', adminRole: 'support', password: '', isActive: true };

export default function AccessPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<'admins' | 'roles' | 'activity'>('admins');
    const { data: access } = useQuery({ queryKey: ['admin-access'], queryFn: async () => (await api.get('/admin/access')).data.data });
    const { data: admins } = useQuery({ queryKey: ['admin-admins'], queryFn: async () => (await api.get('/admin/admins')).data.data as any[] });
    const [page, setPage] = useState(1);
    const { data: audit } = useQuery({ queryKey: ['admin-audit', page], queryFn: async () => (await api.get(`/admin/audit?limit=50&page=${page}`)).data.data, enabled: tab === 'activity', placeholderData: (prev) => prev });

    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);
    const [flash, setFlash] = useState('');
    const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 5000); };
    const refresh = () => qc.invalidateQueries({ queryKey: ['admin-admins'] });
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const roles: any[] = access?.roles || [];
    const meId = access?.me?.id;
    const label = (key: string) => roles.find((r) => r.key === key)?.label || key;

    const save = useMutation({
        mutationFn: async () => {
            if (editing) {
                const self = editing._id === meId;
                const body: any = { name: form.name };
                if (!self) { body.adminRole = form.adminRole; body.isActive = form.isActive; }
                if (form.password) body.password = form.password;
                return (await api.patch(`/admin/admins/${editing._id}`, body)).data;
            }
            return (await api.post('/admin/admins', { name: form.name, mobile: form.mobile, adminRole: form.adminRole, password: form.password })).data;
        },
        onSuccess: (r) => { setModal(false); refresh(); say(r.message || 'Saved'); },
        onError: (e) => setErr(apiErr(e)),
    });
    const remove = useMutation({
        mutationFn: async () => (await api.delete(`/admin/admins/${del._id}`)).data,
        onSuccess: (r) => { setDel(null); refresh(); say(r.message || 'Deleted'); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });

    const tabs: [typeof tab, string, any][] = [['admins', 'Admin logins', Users], ['roles', 'Roles', ShieldCheck], ['activity', 'Activity log', History]];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Access control</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Who can sign in to this console, what each role may do, and what was changed.</p>
                </div>
                {tab === 'admins' && <button className="wp-btn wp-btn-primary" onClick={() => { setEditing(null); setForm(empty); setErr(''); setModal(true); }}><Plus size={16} /> Add admin</button>}
            </div>
            {flash && <div className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>{flash}</div>}

            <div className="flex gap-1 p-1 rounded-xl w-fit max-w-full overflow-x-auto" style={{ background: 'var(--surface-2)' }}>
                {tabs.map(([k, text, Icon]) => (
                    <button key={k} onClick={() => setTab(k)} className="px-3.5 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        style={tab === k ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}><Icon size={15} /> {text}</button>
                ))}
            </div>

            {tab === 'admins' && (
                <div className="wp-card overflow-hidden">
                    <div className="overflow-x-auto wp-scroll">
                        <table className="w-full text-sm" style={{ minWidth: 640 }}>
                            <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left whitespace-nowrap">
                                <th className="p-3 font-medium">Admin</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Last sign-in</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium text-right">Actions</th>
                            </tr></thead>
                            <tbody>
                                {(admins || []).map((a) => {
                                    const self = a._id === meId;
                                    return (
                                        <tr key={a._id} style={{ borderTop: '1px solid var(--card-border)', opacity: a.isActive ? 1 : 0.65 }}>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-9 w-9 grid place-items-center rounded-full font-bold text-xs shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}>{a.name.charAt(0).toUpperCase()}</div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.name}{self && <span className="wp-chip ml-2" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>You</span>}</p>
                                                        <p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{a.mobile}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3"><span className="wp-chip whitespace-nowrap" style={ROLE_TONE[a.adminRole] || ROLE_TONE.viewer}><ShieldCheck size={11} /> {label(a.adminRole)}</span></td>
                                            <td className="p-3 whitespace-nowrap tabular" style={{ color: 'var(--text-secondary)' }}>{when(a.lastLogin)}</td>
                                            <td className="p-3"><span className="wp-chip whitespace-nowrap" style={a.isActive ? { background: 'var(--success-tint)', color: 'var(--success)' } : { background: 'var(--danger-tint)', color: 'var(--danger)' }}><Power size={11} /> {a.isActive ? 'Active' : 'Off'}</span></td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button className="wp-btn wp-btn-ghost !p-2" title="Edit" aria-label={`Edit ${a.name}`} onClick={() => { setEditing(a); setForm({ name: a.name, mobile: a.mobile, adminRole: a.adminRole, password: '', isActive: a.isActive }); setErr(''); setModal(true); }}><Pencil size={14} /></button>
                                                    <button className="wp-btn wp-btn-ghost !p-2" title={self ? 'You can not delete your own login' : 'Delete'} aria-label={`Delete ${a.name}`} disabled={self} style={{ color: 'var(--danger)' }} onClick={() => setDel(a)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'roles' && (
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {roles.map((r) => (
                            <div key={r.key} className="wp-card p-4">
                                <span className="wp-chip" style={ROLE_TONE[r.key]}><ShieldCheck size={11} /> {r.label}</span>
                                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{r.description}</p>
                                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{(admins || []).filter((a) => a.adminRole === r.key).length} login(s)</p>
                            </div>
                        ))}
                    </div>
                    <div className="wp-card overflow-hidden">
                        <div className="overflow-x-auto wp-scroll">
                            <table className="w-full text-sm" style={{ minWidth: 560 }}>
                                <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                                    <th className="p-3 font-medium">Area</th>
                                    {roles.map((r) => <th key={r.key} className="p-3 font-medium text-center">{r.label}</th>)}
                                </tr></thead>
                                <tbody>
                                    {PERM_ROWS.map(([area, view, manage]) => (
                                        <tr key={area} style={{ borderTop: '1px solid var(--card-border)' }}>
                                            <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{area}</td>
                                            {roles.map((r) => {
                                                const canView = r.perms.includes(view);
                                                const canManage = !!manage && r.perms.includes(manage);
                                                return (
                                                    <td key={r.key} className="p-3 text-center">
                                                        {canManage ? <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><Check size={11} /> {view === manage ? 'Yes' : 'View + change'}</span>
                                                            : canView ? <span className="wp-chip" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>View only</span>
                                                            : <X size={15} className="inline" style={{ color: 'var(--text-muted)' }} />}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'activity' && (
                <>
                    <div className="wp-card overflow-hidden">
                        <div className="overflow-x-auto wp-scroll">
                            <table className="w-full text-sm" style={{ minWidth: 600 }}>
                                <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left whitespace-nowrap">
                                    <th className="p-3 font-medium">When</th><th className="p-3 font-medium">Admin</th><th className="p-3 font-medium">What</th><th className="p-3 font-medium">Details</th>
                                </tr></thead>
                                <tbody>
                                    {(audit?.items || []).map((x: any) => (
                                        <tr key={x._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                            <td className="p-3 whitespace-nowrap tabular" style={{ color: 'var(--text-secondary)' }}>{when(x.createdAt)}</td>
                                            <td className="p-3 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{x.adminName}</td>
                                            <td className="p-3" style={{ color: 'var(--text-primary)' }}>{x.action}</td>
                                            <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>{x.detail || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!audit?.items?.length && <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Nothing has been changed yet.</p>}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Every change made in this console is listed here for 180 days. Passwords and messages are never stored in the log.</p>
                    {audit?.meta && audit.meta.totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
                            <span>Page {audit.meta.page} of {audit.meta.totalPages}</span>
                            <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= audit.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Older</button>
                        </div>
                    )}
                </>
            )}

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'Add admin login'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name.trim() || (!editing && (!form.mobile || !form.password))} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create admin login'}</button>}>
                <Field label="Name"><input className="wp-input" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
                {!editing && <Field label="Mobile (used to sign in)"><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} /></Field>}
                {(!editing || editing._id !== meId) && (
                    <Field label="Role">
                        <select className="wp-input" value={form.adminRole} onChange={(e) => set('adminRole', e.target.value)}>
                            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{roles.find((r) => r.key === form.adminRole)?.description}</p>
                    </Field>
                )}
                <Field label={editing ? 'New password (leave empty to keep the current one)' : 'Password'}>
                    <div className="relative">
                        <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input className="wp-input pl-10" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                    </div>
                </Field>
                {editing && editing._id !== meId && (
                    <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Login is active
                    </label>
                )}
                {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} title={`Delete ${del?.name}?`} confirmLabel="Delete admin login"
                message="This admin can no longer sign in to the console. What they changed stays in the activity log." />
        </div>
    );
}
