'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MessageCircle, BellRing, CheckCircle2, Printer, Ban, Zap, IndianRupee, AlertTriangle, Wallet, Copy, HandCoins } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { day, periodLabel, waLink, printSubscriptionBill } from '@/lib/billing';

const TABS: [string, string][] = [['', 'All'], ['due', 'Due'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['cancelled', 'Cancelled']];
const PAID_MODES: [string, string][] = [['upi', 'UPI'], ['bank', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['other', 'Other']];
const bills = (n: number) => `${n} ${n === 1 ? 'bill' : 'bills'}`;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function Tile({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: any; tone: { bg: string; fg: string } }) {
    return (
        <div className="wp-card p-4 flex items-center gap-3">
            <div className="h-11 w-11 grid place-items-center rounded-2xl shrink-0" style={{ background: tone.bg, color: tone.fg }}><Icon size={20} /></div>
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-xl font-extrabold tabular leading-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
            </div>
        </div>
    );
}

function StatusChip({ b }: { b: any }) {
    if (b.status === 'paid') return <span className="wp-chip whitespace-nowrap" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>Paid</span>;
    if (b.status === 'cancelled') return <span className="wp-chip whitespace-nowrap" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Cancelled</span>;
    if (b.overdue) return <span className="wp-chip whitespace-nowrap" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>Overdue</span>;
    return <span className="wp-chip whitespace-nowrap" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>Due</span>;
}

export default function BillingPage() {
    const qc = useQueryClient();
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

    const params = new URLSearchParams({ limit: '50', page: String(page), status, search: q }).toString();
    const { data } = useQuery({ queryKey: ['admin-bills', params], queryFn: async () => (await api.get(`/admin/bills?${params}`)).data.data, placeholderData: (prev) => prev });
    const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get('/admin/settings')).data.data });
    const { data: businesses } = useQuery({ queryKey: ['admin-businesses-lite'], queryFn: async () => (await api.get('/admin/businesses?lite=1&limit=100')).data.data.items as any[] });
    const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/admin/plans')).data.data as any[] });

    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ businessId: '', periods: '1', amount: '', note: '' });
    const [err, setErr] = useState('');
    const [sent, setSent] = useState<{ title: string; whatsapp: any } | null>(null); // message ready for WhatsApp
    const [payFor, setPayFor] = useState<any>(null);
    const [pay, setPay] = useState({ paidMode: 'upi', paidRef: '', paidAt: today() });
    const [cancelFor, setCancelFor] = useState<any>(null);
    const [runAll, setRunAll] = useState(false);
    const [flash, setFlash] = useState('');
    const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 5000); };
    const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-bills'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); };

    const create = useMutation({
        mutationFn: async () => (await api.post('/admin/bills', { businessId: form.businessId, periods: form.periods, amount: form.amount, note: form.note })).data,
        onSuccess: (r) => { setCreating(false); refresh(); setSent({ title: r.message, whatsapp: r.data.whatsapp }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const remind = useMutation({
        mutationFn: async (id: string) => (await api.post(`/admin/bills/${id}/remind`)).data,
        onSuccess: (r) => { refresh(); setSent({ title: r.message, whatsapp: r.data.whatsapp }); },
        onError: (e) => alert(apiErr(e)),
    });
    const markPaid = useMutation({
        mutationFn: async () => (await api.patch(`/admin/bills/${payFor._id}`, { status: 'paid', ...pay })).data,
        onSuccess: (r) => { setPayFor(null); refresh(); say(`${r.data.billNo} marked paid`); },
        onError: (e) => setErr(apiErr(e)),
    });
    const cancel = useMutation({
        mutationFn: async () => (await api.patch(`/admin/bills/${cancelFor._id}`, { status: 'cancelled' })).data,
        onSuccess: () => { setCancelFor(null); refresh(); say('Bill cancelled'); },
        onError: (e) => { setCancelFor(null); alert(apiErr(e)); },
    });
    const run = useMutation({
        mutationFn: async () => (await api.post('/admin/bills/run')).data,
        onSuccess: (r) => { setRunAll(false); refresh(); say(r.message); },
        onError: (e) => { setRunAll(false); alert(apiErr(e)); },
    });

    const items: any[] = data?.items || [];
    const meta = data?.meta;
    const sum = data?.summary || {};
    const picked = (businesses || []).find((b: any) => b._id === form.businessId);
    const plan = (plans || []).find((p: any) => p.key === picked?.plan);
    const base = form.amount !== '' ? Number(form.amount) || 0 : (plan?.price || 0) * (Number(form.periods) || 1);
    const gstRate = settings?.company?.gstin ? settings.billing.gstRate : 0;
    const unit = plan?.period === 'year' ? 'year' : 'month';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Subscription bills</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Bill businesses for their plan, remind them, and record payments.</p>
                </div>
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost" onClick={() => setRunAll(true)}><Zap size={16} /> Bill everyone</button>
                    <button className="wp-btn wp-btn-primary" onClick={() => { setForm({ businessId: '', periods: '1', amount: '', note: '' }); setErr(''); setCreating(true); }}><Plus size={16} /> New bill</button>
                </div>
            </div>
            {flash && <div className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>{flash}</div>}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Tile label="To collect" value={inr(sum.dueTotal || 0)} sub={`${bills(sum.dueCount || 0)} due`} icon={Wallet} tone={{ bg: 'var(--warning-tint)', fg: 'var(--warning)' }} />
                <Tile label="Overdue" value={inr(sum.overdueTotal || 0)} sub={`${bills(sum.overdueCount || 0)} past the due date`} icon={AlertTriangle} tone={{ bg: 'var(--danger-tint)', fg: 'var(--danger)' }} />
                <Tile label="Collected this month" value={inr(sum.paidThisMonth || 0)} sub={`${bills(sum.paidCountThisMonth || 0)} paid`} icon={IndianRupee} tone={{ bg: 'var(--success-tint)', fg: 'var(--success)' }} />
                <Tile label="Owner says paid" value={String(sum.claimedCount || 0)} sub="waiting for you to confirm" icon={HandCoins} tone={{ bg: 'var(--brand-tint)', fg: 'var(--brand-text)' }} />
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
                    <input className="wp-input pl-11" placeholder="Search by bill no. or business…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 900 }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left whitespace-nowrap">
                                <th className="p-3 font-medium">Bill</th><th className="p-3 font-medium">Business</th><th className="p-3 font-medium">Plan · period</th>
                                <th className="p-3 font-medium text-right">Amount</th><th className="p-3 font-medium">Due</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((b) => (
                                <tr key={b._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3 whitespace-nowrap"><p className="font-semibold tabular" style={{ color: 'var(--text-primary)' }}>{b.billNo}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{day(b.createdAt)}</p></td>
                                    <td className="p-3"><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.businessName}</p><p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{b.ownerName} · {b.ownerMobile}</p></td>
                                    <td className="p-3"><p style={{ color: 'var(--text-secondary)' }}>{b.planName}</p><p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{periodLabel(b)}</p></td>
                                    <td className="p-3 text-right whitespace-nowrap"><p className="font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(b.total)}</p>{b.gstAmount > 0 && <p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>incl. GST {inr2(b.gstAmount)}</p>}</td>
                                    <td className="p-3 whitespace-nowrap tabular" style={{ color: b.overdue ? 'var(--danger)' : 'var(--text-secondary)' }}>{b.status === 'paid' ? `Paid ${day(b.paidAt)}` : day(b.dueDate)}</td>
                                    <td className="p-3">
                                        <StatusChip b={b} />
                                        {b.status === 'due' && b.claimedAt && <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--brand-text)' }}>Owner says paid{b.claimRef ? ` · ${b.claimRef}` : ''}</p>}
                                        {b.status === 'due' && b.reminders > 0 && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{b.reminders} reminder{b.reminders === 1 ? '' : 's'}</p>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {b.status === 'due' && <>
                                                <button className="wp-btn wp-btn-collect !p-2" title="Mark paid" aria-label={`Mark ${b.billNo} paid`} onClick={() => { setPayFor(b); setPay({ paidMode: 'upi', paidRef: b.claimRef || '', paidAt: today() }); setErr(''); }}><CheckCircle2 size={15} /></button>
                                                <button className="wp-btn wp-btn-ghost !p-2" title="Remind (app + WhatsApp)" aria-label={`Remind ${b.businessName}`} disabled={remind.isPending} onClick={() => remind.mutate(b._id)}><BellRing size={15} /></button>
                                            </>}
                                            <button className="wp-btn wp-btn-ghost !p-2" title="Print" aria-label={`Print ${b.billNo}`} onClick={() => printSubscriptionBill(b, settings)}><Printer size={15} /></button>
                                            {b.status === 'due' && <button className="wp-btn wp-btn-ghost !p-2" title="Cancel bill" aria-label={`Cancel ${b.billNo}`} style={{ color: 'var(--danger)' }} onClick={() => setCancelFor(b)}><Ban size={15} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!items.length && <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No bills here yet. Use “New bill” or “Bill everyone”.</p>}
            </div>
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>Page {meta.page} of {meta.totalPages} · {meta.total} bills</span>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}

            {/* New bill */}
            <Modal open={creating} onClose={() => setCreating(false)} title="New subscription bill"
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={create.isPending || !form.businessId} onClick={() => create.mutate()}>{create.isPending ? 'Creating…' : `Create bill${base > 0 ? ` · ${inr2(base * (1 + gstRate / 100))}` : ''}`}</button>}>
                <Field label="Business">
                    <select className="wp-input" value={form.businessId} autoFocus onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
                        <option value="">Choose a business…</option>
                        {(businesses || []).map((b: any) => <option key={b._id} value={b._id}>{b.name} · {b.plan}</option>)}
                    </select>
                </Field>
                {picked && (
                    <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        {plan ? <>On <b style={{ color: 'var(--text-primary)' }}>{plan.name}</b> — {plan.price > 0 ? `${inr(plan.price)} a ${unit}` : 'free, so enter an amount below'}</> : 'Plan not found'}
                        {gstRate > 0 ? ` · ${gstRate}% GST is added` : ' · no GST (add your GSTIN in Settings to charge it)'}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label={`How many ${unit}s`}><input className="wp-input" type="number" min={1} max={36} value={form.periods} onChange={(e) => setForm({ ...form, periods: e.target.value })} /></Field>
                    <Field label="Amount before GST (optional)"><input className="wp-input" type="number" min={0} value={form.amount} placeholder={plan ? String((plan.price || 0) * (Number(form.periods) || 1)) : ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
                </div>
                <Field label="Note on the bill (optional)"><input className="wp-input" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Setup fee, discount…" /></Field>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>The period starts where this business's last bill ended. The owner gets a notification in the app.</p>
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>

            {/* Message ready for WhatsApp */}
            <Modal open={!!sent} onClose={() => setSent(null)} title="Send on WhatsApp"
                footer={sent?.whatsapp?.mobile ? (
                    <div className="flex gap-2">
                        <button className="wp-btn wp-btn-ghost flex-1" onClick={() => { navigator.clipboard?.writeText(sent.whatsapp.text); say('Message copied'); }}><Copy size={15} /> Copy</button>
                        <a className="wp-btn wp-btn-collect flex-1" href={waLink(sent.whatsapp)} target="_blank" rel="noreferrer" onClick={() => setSent(null)}><MessageCircle size={15} /> Open WhatsApp</a>
                    </div>
                ) : <button className="wp-btn wp-btn-ghost w-full" onClick={() => setSent(null)}>Close</button>}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--success)' }}>{sent?.title}</p>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{sent?.whatsapp?.mobile ? `To ${sent.whatsapp.countryCode} ${sent.whatsapp.mobile} — WhatsApp opens with this message, you press send:` : 'This business has no owner mobile — the message could not be addressed.'}</p>
                <div className="rounded-xl p-3 text-sm whitespace-pre-wrap" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>{sent?.whatsapp?.text}</div>
            </Modal>

            {/* Mark paid */}
            <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`Payment for ${payFor?.billNo || ''}`}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={markPaid.isPending} onClick={() => markPaid.mutate()}>{markPaid.isPending ? 'Saving…' : `Mark paid · ${inr2(payFor?.total || 0)}`}</button>}>
                <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    <b style={{ color: 'var(--text-primary)' }}>{payFor?.businessName}</b> · {payFor?.planName}{payFor?.claimedAt ? ` · owner says paid on ${day(payFor.claimedAt)}` : ''}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Paid by"><select className="wp-input" value={pay.paidMode} onChange={(e) => setPay({ ...pay, paidMode: e.target.value })}>{PAID_MODES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                    <Field label="Paid on"><input className="wp-input" type="date" max={today()} value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} /></Field>
                </div>
                <Field label="Reference no. (optional)"><input className="wp-input" value={pay.paidRef} maxLength={60} onChange={(e) => setPay({ ...pay, paidRef: e.target.value })} placeholder="UPI / bank reference" /></Field>
                {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!cancelFor} onClose={() => setCancelFor(null)} onConfirm={() => cancel.mutate()} loading={cancel.isPending} title={`Cancel ${cancelFor?.billNo}?`} confirmLabel="Cancel bill"
                message="The owner will no longer see this bill. You can make a new one for the same period afterwards." />
            <ConfirmDialog open={runAll} onClose={() => setRunAll(false)} onConfirm={() => run.mutate()} loading={run.isPending} danger={false} title="Bill everyone?" confirmLabel="Create bills"
                message="Every active business on a paid plan that has no bill running past today gets a bill for its next period, and a notification in the app. Nobody is billed twice." />
        </div>
    );
}
