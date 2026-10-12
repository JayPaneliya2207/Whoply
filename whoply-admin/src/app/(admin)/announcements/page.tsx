'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Pencil, Trash2, ImagePlus, X, CalendarDays, Store, Users, ExternalLink, Loader2 } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Status = 'live' | 'scheduled' | 'ended' | 'off';
const STATUS: Record<Status, { label: string; style: React.CSSProperties }> = {
    live: { label: 'Live now', style: { background: 'var(--success-tint)', color: 'var(--success)' } },
    scheduled: { label: 'Scheduled', style: { background: 'var(--brand-tint)', color: 'var(--brand-text)' } },
    ended: { label: 'Ended', style: { background: 'var(--surface-2)', color: 'var(--text-secondary)' } },
    off: { label: 'Switched off', style: { background: 'var(--surface-2)', color: 'var(--text-secondary)' } },
};
const AUDIENCE: Record<string, string> = { all: 'All businesses', retail: 'Shops only', wholesale: 'Wholesalers only' };
const empty = { title: '', body: '', image: '' as string | undefined, linkUrl: '', linkLabel: '', audience: 'all', staffToo: false, isActive: true, startDate: '', endDate: '' };
const dmy = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dates = (a: any) => (a.startDate && a.endDate ? `${dmy(a.startDate)} to ${dmy(a.endDate)}` : a.startDate ? `From ${dmy(a.startDate)}, no end date` : a.endDate ? `Until ${dmy(a.endDate)}` : 'No dates — shows until switched off');

/** Shrink a chosen picture so the poster stays light on a phone: longest side 1400px, JPEG. */
async function shrink(file: File): Promise<string> {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('That file is not a picture')); img.src = url; });
        for (const [side, quality] of [[1400, 0.85], [1100, 0.8], [900, 0.72]] as const) {
            const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * k);
            canvas.height = Math.round(img.naturalHeight * k);
            const g = canvas.getContext('2d')!;
            g.fillStyle = '#fff'; // a transparent PNG becomes white, not black, as a JPEG
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/jpeg', quality);
            if (data.length <= 1_300_000) return data;
        }
        throw new Error('That picture is too heavy even after shrinking. Try a simpler one.');
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** On / off switch. */
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60" style={{ background: on ? 'var(--success)' : 'var(--card-border)' }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
        </button>
    );
}

/** How the popup will look in the app. */
function Preview({ form }: { form: any }) {
    return (
        <div className="rounded-2xl overflow-hidden mx-auto w-full max-w-[260px]" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-md)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {form.image && <img src={form.image} alt="" className="block w-full max-h-[300px] object-contain" style={{ background: 'var(--surface-2)' }} />}
            <div className="p-4">
                <p className="font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{form.title || 'Your headline'}</p>
                {form.body && <p className="text-sm mt-1.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{form.body}</p>}
                {form.linkUrl && <span className="wp-btn wp-btn-primary w-full mt-3 !py-2 text-sm">{form.linkLabel || 'Open'} <ExternalLink size={13} /></span>}
            </div>
        </div>
    );
}

export default function AnnouncementsPage() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [busyPic, setBusyPic] = useState(false);
    const [del, setDel] = useState<any>(null);
    const file = useRef<HTMLInputElement>(null);
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    const { data } = useQuery({ queryKey: ['admin-announcements'], queryFn: async () => (await api.get('/admin/announcements')).data.data, refetchInterval: 60_000 });
    const refresh = () => qc.invalidateQueries({ queryKey: ['admin-announcements'] });

    const openNew = () => { setEditing(null); setForm(empty); setErr(''); setModal(true); };
    // The list comes without posters; fetch this one's before editing. `image: undefined` = leave the poster as it is.
    const openEdit = async (a: any) => {
        setEditing(a); setErr('');
        setForm({ title: a.title, body: a.body || '', image: undefined, linkUrl: a.linkUrl || '', linkLabel: a.linkLabel || '', audience: a.audience, staffToo: !!a.staffToo, isActive: a.isActive, startDate: a.startDate || '', endDate: a.endDate || '' });
        setModal(true);
        if (a.hasImage) {
            try { const full = (await api.get(`/admin/announcements/${a._id}`)).data.data; setForm((f: any) => (f.image === undefined ? { ...f, image: full.image || '' } : f)); } catch { /* the form still works without the preview */ }
        }
    };

    const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setBusyPic(true); setErr('');
        try { set('image', await shrink(f)); } catch (x: any) { setErr(x?.message || 'Could not read that picture'); } finally { setBusyPic(false); }
    };

    const save = useMutation({
        mutationFn: async () => {
            const body: any = { ...form };
            if (body.image === undefined) delete body.image; // unchanged
            if (editing) return (await api.patch(`/admin/announcements/${editing._id}`, body)).data.data;
            return (await api.post('/admin/announcements', body)).data.data;
        },
        onSuccess: () => { setModal(false); refresh(); },
        onError: (e) => setErr(apiErr(e)),
    });
    const toggle = useMutation({
        mutationFn: async ({ id, isActive }: any) => (await api.patch(`/admin/announcements/${id}`, { isActive })).data.data,
        onSuccess: refresh,
        onError: (e) => alert(apiErr(e)),
    });
    const remove = useMutation({
        mutationFn: async () => (await api.delete(`/admin/announcements/${del._id}`)).data,
        onSuccess: () => { setDel(null); refresh(); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });

    const items: any[] = data?.items || [];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>App popups</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>An offer poster, a news headline or a notice. It opens when a business opens the app, and they can close it{data ? ` · ${data.live} live now` : ''}.</p>
                </div>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> New popup</button>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                {items.map((a) => {
                    const st = STATUS[a.status as Status] || STATUS.off;
                    return (
                        <div key={a._id} className="wp-card p-4" style={{ opacity: a.status === 'live' || a.status === 'scheduled' ? 1 : 0.72 }}>
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 grid place-items-center rounded-xl shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><Megaphone size={18} /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="wp-chip" style={st.style}>{st.label}</span>
                                        {a.hasImage && <span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}><ImagePlus size={11} /> Poster</span>}
                                    </div>
                                    <p className="font-bold mt-1.5 break-words" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                                    {a.body && <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{a.body}</p>}
                                </div>
                                <Switch on={a.isActive} disabled={toggle.isPending} label={`Switch ${a.isActive ? 'off' : 'on'}: ${a.title}`} onChange={(v) => toggle.mutate({ id: a._id, isActive: v })} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                                <span className="flex items-center gap-1"><CalendarDays size={12} /> {dates(a)}</span>
                                <span className="flex items-center gap-1"><Store size={12} /> {AUDIENCE[a.audience] || a.audience}</span>
                                <span className="flex items-center gap-1"><Users size={12} /> {a.staffToo ? 'Owners and staff' : 'Owners only'}</span>
                                <span className="ml-auto flex gap-1">
                                    <button className="wp-btn wp-btn-ghost !p-2" title="Edit" aria-label={`Edit ${a.title}`} onClick={() => openEdit(a)}><Pencil size={14} /></button>
                                    <button className="wp-btn wp-btn-ghost !p-2" title="Delete" aria-label={`Delete ${a.title}`} style={{ color: 'var(--danger)' }} onClick={() => setDel(a)}><Trash2 size={14} /></button>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {data && !items.length && (
                <div className="wp-card p-10 text-center">
                    <Megaphone size={28} className="mx-auto" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>No popups yet</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Make one for an offer or a piece of news. You choose the days it shows and can switch it off at any time.</p>
                    <button className="wp-btn wp-btn-primary mt-4" onClick={openNew}><Plus size={16} /> New popup</button>
                </div>
            )}

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit popup' : 'New popup'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || busyPic || form.title.trim().length < 2} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create popup'}</button>}>
                <Field label="Headline"><input className="wp-input" value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Diwali offer: 2 months free" /></Field>
                <Field label="Message (optional)"><textarea className="wp-input" rows={3} value={form.body} maxLength={1000} onChange={(e) => set('body', e.target.value)} placeholder="A line or two about it" /></Field>

                <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poster (optional)</p>
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
                <div className="flex items-center gap-2 mb-3">
                    <button type="button" className="wp-btn wp-btn-ghost" disabled={busyPic} onClick={() => file.current?.click()}>{busyPic ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} {form.image ? 'Change poster' : 'Upload poster'}</button>
                    {form.image && <button type="button" className="wp-btn wp-btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => set('image', '')}><X size={15} /> Remove</button>}
                    {editing?.hasImage && form.image === undefined && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading the poster…</span>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Button text (optional)"><input className="wp-input" value={form.linkLabel} maxLength={30} onChange={(e) => set('linkLabel', e.target.value)} placeholder="See the offer" /></Field>
                    <Field label="Button link"><input className="wp-input" value={form.linkUrl} maxLength={300} onChange={(e) => set('linkUrl', e.target.value.trim())} placeholder="https://…" inputMode="url" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Show from"><input className="wp-input" type="date" value={form.startDate} max={form.endDate || undefined} onChange={(e) => set('startDate', e.target.value)} /></Field>
                    <Field label="Show until (last day)"><input className="wp-input" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} /></Field>
                </div>
                <p className="text-xs -mt-1 mb-3" style={{ color: 'var(--text-muted)' }}>Leave the dates empty to show it from now until you switch it off. Days are India time.</p>
                <Field label="Show to"><select className="wp-input" value={form.audience} onChange={(e) => set('audience', e.target.value)}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.staffToo} onChange={(e) => set('staffToo', e.target.checked)} /> Show to staff too (cashiers, managers…). Otherwise only the owner sees it.
                </label>
                <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Switched on
                </label>

                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>How it looks in the app</p>
                <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}><Preview form={form} /></div>
                {err && <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} title="Delete this popup?" confirmLabel="Delete"
                message={`“${del?.title || ''}” will stop showing in the app and can not be brought back. To hide it for a while, switch it off instead.`} />
        </div>
    );
}
