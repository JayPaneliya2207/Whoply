'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Phone, MessageCircle, Mail, Trash2, Store, Layers, HelpCircle, MapPin, StickyNote, Check } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const TABS: [string, string][] = [['', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']];
const STATUS_TONE: Record<string, React.CSSProperties> = {
    new: { background: 'var(--accent-tint)', color: 'var(--accent-strong)' },
    contacted: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    closed: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};
const TYPE: Record<string, [string, any]> = { retail: ['Shopkeeper', Store], wholesale: ['Wholesaler', Layers], other: ['Other', HelpCircle] };
const when = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One inquiry: who, what they asked, ways to reach them, status and a private note. */
function Card({ q, onPatch, onDelete, busy }: { q: any; onPatch: (body: any) => void; onDelete: () => void; busy: boolean }) {
    const [note, setNote] = useState(q.note || '');
    const [typeLabel, TypeIcon] = TYPE[q.businessType] || TYPE.other;
    const hello = `Hello ${q.name}, this is the Whoply team. Thank you for contacting us.`;
    return (
        <div className="wp-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{q.name}</p>
                    <p className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1"><TypeIcon size={12} /> {typeLabel}</span>
                        {q.city && <span className="flex items-center gap-1"><MapPin size={12} /> {q.city}</span>}
                        <span>{when(q.createdAt)}</span>
                        {q.lang && q.lang !== 'en' && <span className="uppercase">{q.lang}</span>}
                    </p>
                </div>
                <select value={q.status} disabled={busy} onChange={(e) => onPatch({ status: e.target.value })} className="wp-chip capitalize border-0 outline-none cursor-pointer !text-xs !py-1.5" style={STATUS_TONE[q.status]} aria-label="Status">
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
                </select>
            </div>
            <p className="text-sm mt-3 whitespace-pre-wrap break-words rounded-xl p-3" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>{q.message}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
                <a className="wp-btn wp-btn-ghost !py-1.5" href={`tel:+91${q.mobile}`}><Phone size={14} /> {q.mobile}</a>
                <a className="wp-btn wp-btn-collect !py-1.5" target="_blank" rel="noreferrer" href={`https://wa.me/91${q.mobile}?text=${encodeURIComponent(hello)}`}><MessageCircle size={14} /> WhatsApp</a>
                {q.email && <a className="wp-btn wp-btn-ghost !py-1.5" href={`mailto:${q.email}`}><Mail size={14} /> {q.email}</a>}
                <button className="wp-btn wp-btn-ghost !p-2 ml-auto" title="Delete" aria-label={`Delete inquiry from ${q.name}`} style={{ color: 'var(--danger)' }} onClick={onDelete}><Trash2 size={14} /></button>
            </div>
            <div className="flex items-center gap-2 mt-3">
                <StickyNote size={15} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input className="wp-input !py-2 flex-1" placeholder="Your note (only admins see this)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                {note !== (q.note || '') && <button className="wp-btn wp-btn-primary !py-2 shrink-0" disabled={busy} onClick={() => onPatch({ note })}><Check size={14} /> Save</button>}
            </div>
        </div>
    );
}

export default function InquiriesPage() {
    const qc = useQueryClient();
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

    const params = new URLSearchParams({ limit: '30', page: String(page), status, search: q }).toString();
    const { data } = useQuery({ queryKey: ['admin-inquiries', params], queryFn: async () => (await api.get(`/admin/inquiries?${params}`)).data.data, refetchInterval: 30_000, placeholderData: (prev) => prev });
    const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-inquiries'] }); qc.invalidateQueries({ queryKey: ['inquiry-summary'] }); };
    const [del, setDel] = useState<any>(null);

    const patch = useMutation({
        mutationFn: async ({ id, body }: any) => (await api.patch(`/admin/inquiries/${id}`, body)).data,
        onSuccess: refresh,
        onError: (e) => alert(apiErr(e)),
    });
    const remove = useMutation({
        mutationFn: async () => (await api.delete(`/admin/inquiries/${del._id}`)).data,
        onSuccess: () => { setDel(null); refresh(); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });

    const items: any[] = data?.items || [];
    const meta = data?.meta;
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Contact inquiries</h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Messages from the “Contact us” form on the website{data?.summary ? ` · ${data.summary.new} new` : ''}.</p>
            </div>
            <div className="wp-card p-3 flex flex-wrap items-center gap-2">
                <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--surface-2)' }}>
                    {TABS.map(([k, label]) => (
                        <button key={k} onClick={() => { setStatus(k); setPage(1); }} className="px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap"
                            style={status === k ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}>{label}</button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input className="wp-input pl-11" placeholder="Search name, mobile, city or message…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                {items.map((x) => <Card key={x._id + (x.note || '') + x.status} q={x} busy={patch.isPending} onPatch={(body) => patch.mutate({ id: x._id, body })} onDelete={() => setDel(x)} />)}
            </div>
            {!items.length && <div className="wp-card p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No inquiries here. When someone fills the Contact us form on the website, it shows up in this list.</div>}
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>Page {meta.page} of {meta.totalPages} · {meta.total} inquiries</span>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} title="Delete this inquiry?" confirmLabel="Delete"
                message={`From ${del?.name || ''}. Use this for spam — it can not be brought back.`} />
        </div>
    );
}
