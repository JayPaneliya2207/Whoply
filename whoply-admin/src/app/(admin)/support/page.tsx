'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Send, Store, Layers, CheckCheck, RotateCcw, ArrowLeft, MessageSquarePlus, Loader2, Phone, MessagesSquare } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';

interface Msg { _id: string; from: 'business' | 'admin'; senderName: string; text: string; createdAt: string }

const timeOf = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayOf = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
/** "2:15 pm" today, "3 Oct" before that — for the chat list. */
const shortWhen = (d: string) => (new Date(d).toDateString() === new Date().toDateString() ? timeOf(d) : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

/** One open chat: its messages (new ones fetched every few seconds), reply box, solved / reopen. */
function Chat({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
    const [info, setInfo] = useState<any>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [err, setErr] = useState('');
    const last = useRef('');
    const boxRef = useRef<HTMLDivElement>(null);

    const add = (incoming: Msg[]) => setMessages((prev) => {
        const have = new Set(prev.map((m) => m._id));
        const fresh = incoming.filter((m) => !have.has(m._id));
        return fresh.length ? [...prev, ...fresh] : prev;
    });
    const load = useCallback(async () => {
        try {
            const { data } = await api.get(`/admin/support/threads/${id}` + (last.current ? `?after=${encodeURIComponent(last.current)}` : ''));
            const d = data.data;
            setInfo((cur: any) => ({ ...(cur || {}), thread: d.thread, owner: d.owner || cur?.owner }));
            if (d.messages.length) {
                add(d.messages);
                last.current = d.messages[d.messages.length - 1].createdAt;
                if (d.messages.some((m: Msg) => m.from === 'business')) onChanged(); // its unread count was just cleared
            }
        } catch { /* try again on the next tick */ }
    }, [id, onChanged]);

    useEffect(() => {
        setMessages([]); setInfo(null); setErr(''); last.current = '';
        load();
        const t = setInterval(() => { if (!document.hidden) load(); }, 4000);
        return () => clearInterval(t);
    }, [id, load]);
    useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [messages.length]);

    const send = async () => {
        if (!text.trim() || sending) return;
        setSending(true); setErr('');
        try {
            const { data } = await api.post(`/admin/support/threads/${id}/messages`, { text });
            add([data.data]);
            if (data.data.createdAt > last.current) last.current = data.data.createdAt;
            setText(''); onChanged();
        } catch (e) { setErr(apiErr(e)); }
        setSending(false);
    };
    const setStatus = async (status: string) => {
        try {
            await api.patch(`/admin/support/threads/${id}`, { status });
            setInfo((cur: any) => ({ ...cur, thread: { ...cur.thread, status } }));
            onChanged();
        } catch (e) { setErr(apiErr(e)); }
    };

    const thread = info?.thread;
    const owner = info?.owner;
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-3 p-3 border-b shrink-0" style={{ borderColor: 'var(--card-border)' }}>
                <button className="lg:hidden h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} onClick={onBack} aria-label="Back to chats"><ArrowLeft size={18} /></button>
                <div className="h-10 w-10 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{thread?.businessType === 'wholesale' ? <Layers size={17} /> : <Store size={17} />}</div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{thread?.businessName || '…'}</p>
                    <p className="text-xs truncate flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>{owner ? <><Phone size={11} /> {owner.name} · {owner.mobile}</> : ' '}</p>
                </div>
                {thread && (thread.status === 'open'
                    ? <button className="wp-btn wp-btn-collect !py-1.5 shrink-0" onClick={() => setStatus('resolved')}><CheckCheck size={15} /> <span className="hidden sm:inline">Mark solved</span></button>
                    : <button className="wp-btn wp-btn-ghost !py-1.5 shrink-0" onClick={() => setStatus('open')}><RotateCcw size={15} /> <span className="hidden sm:inline">Reopen</span></button>)}
            </div>

            <div ref={boxRef} className="flex-1 min-h-0 overflow-y-auto wp-scroll p-4 space-y-2" style={{ background: 'var(--background)' }}>
                {!info && <div className="grid place-items-center py-16" style={{ color: 'var(--text-muted)' }}><Loader2 size={22} className="animate-spin" /></div>}
                {messages.map((m, i) => {
                    const mine = m.from === 'admin';
                    const newDay = i === 0 || dayOf(messages[i - 1].createdAt) !== dayOf(m.createdAt);
                    return (
                        <div key={m._id}>
                            {newDay && <p className="text-center my-3"><span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{dayOf(m.createdAt)}</span></p>}
                            <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                                    style={mine ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                                    <p className="text-[11px] font-semibold mb-0.5" style={{ opacity: 0.75 }}>{m.senderName}{mine ? ' · Whoply' : ''}</p>
                                    <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                                    <p className="text-[10px] text-right mt-1 tabular" style={{ opacity: 0.7 }}>{timeOf(m.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {thread?.status === 'resolved' && <p className="text-center text-xs py-2 flex items-center justify-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCheck size={14} /> Marked solved — a new message from the business opens it again.</p>}
            </div>

            <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--card-border)' }}>
                {err && <p className="text-sm mb-1.5" style={{ color: 'var(--danger)' }}>{err}</p>}
                <div className="flex items-end gap-2">
                    <textarea className="wp-input flex-1 resize-none" rows={2} maxLength={2000} placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)" value={text}
                        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <button className="wp-btn wp-btn-primary !p-3 shrink-0" aria-label="Send" disabled={!text.trim() || sending} onClick={send}>{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
                </div>
            </div>
        </div>
    );
}

export default function SupportPage() {
    const qc = useQueryClient();
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);
    useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);

    const params = new URLSearchParams({ limit: '100', status, search: q }).toString();
    const { data } = useQuery({ queryKey: ['support-threads', params], queryFn: async () => (await api.get(`/admin/support/threads?${params}`)).data.data, refetchInterval: 8000, placeholderData: (prev) => prev });
    const refresh = useCallback(() => { qc.invalidateQueries({ queryKey: ['support-threads'] }); qc.invalidateQueries({ queryKey: ['support-summary'] }); }, [qc]);

    // Start a chat with a business that hasn't written yet
    const { data: businesses } = useQuery({ queryKey: ['admin-businesses-lite'], queryFn: async () => (await api.get('/admin/businesses?lite=1&limit=100')).data.data.items as any[] });
    const [starting, setStarting] = useState(false);
    const [form, setForm] = useState({ businessId: '', text: '' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const start = async () => {
        setBusy(true); setErr('');
        try {
            const { data: r } = await api.post('/admin/support/threads', form);
            setStarting(false); refresh(); setOpenId(r.data._id);
        } catch (e) { setErr(apiErr(e)); }
        setBusy(false);
    };

    const items: any[] = data?.items || [];
    const sum = data?.summary || {};
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Support chat</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{sum.waiting ? `${sum.waiting} ${sum.waiting === 1 ? 'business is' : 'businesses are'} waiting for a reply` : 'Nobody is waiting for a reply'} · {sum.open || 0} open</p>
                </div>
                <button className="wp-btn wp-btn-primary" onClick={() => { setForm({ businessId: '', text: '' }); setErr(''); setStarting(true); }}><MessageSquarePlus size={16} /> New chat</button>
            </div>

            <div className="wp-card overflow-hidden grid lg:grid-cols-[340px_1fr]" style={{ height: 'calc(100dvh - 210px)', minHeight: 440 }}>
                {/* Chat list */}
                <div className={cn('flex flex-col min-h-0 lg:border-r', openId && 'hidden lg:flex')} style={{ borderColor: 'var(--card-border)' }}>
                    <div className="p-3 space-y-2 border-b shrink-0" style={{ borderColor: 'var(--card-border)' }}>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input className="wp-input !py-2 pl-9" placeholder="Search a business…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                            {[['', 'All'], ['open', 'Open'], ['resolved', 'Solved']].map(([k, label]) => (
                                <button key={k} onClick={() => setStatus(k)} className="flex-1 px-2 py-1 rounded-lg text-sm font-semibold"
                                    style={status === k ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}>{label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto wp-scroll">
                        {!items.length && <p className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No chats yet. When an owner writes from the app, it shows here.</p>}
                        {items.map((t) => (
                            <button key={t._id} onClick={() => setOpenId(t._id)} className="w-full text-left flex items-center gap-3 px-3 py-3"
                                style={{ borderBottom: '1px solid var(--card-border)', background: openId === t._id ? 'var(--surface-2)' : 'transparent' }}>
                                <div className="h-10 w-10 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{t.businessType === 'wholesale' ? <Layers size={16} /> : <Store size={16} />}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={cn('truncate text-sm', t.unreadAdmin ? 'font-extrabold' : 'font-semibold')} style={{ color: 'var(--text-primary)' }}>{t.businessName}</p>
                                        <span className="text-[11px] shrink-0 tabular" style={{ color: t.unreadAdmin ? 'var(--accent-strong)' : 'var(--text-muted)' }}>{shortWhen(t.lastAt)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className="truncate text-xs" style={{ color: t.unreadAdmin ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.lastFrom === 'admin' ? 'You: ' : ''}{t.lastText}</p>
                                        {t.unreadAdmin > 0
                                            ? <span className="h-5 min-w-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{t.unreadAdmin}</span>
                                            : t.status === 'resolved' && <CheckCheck size={14} className="shrink-0" style={{ color: 'var(--success)' }} />}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Open chat */}
                <div className={cn('min-h-0', !openId && 'hidden lg:block')}>
                    {openId
                        ? <Chat id={openId} onBack={() => setOpenId(null)} onChanged={refresh} />
                        : <div className="h-full grid place-items-center p-8 text-center" style={{ color: 'var(--text-muted)' }}><div><MessagesSquare size={36} className="mx-auto mb-3" /><p className="text-sm">Pick a chat on the left to read and reply.</p></div></div>}
                </div>
            </div>

            <Modal open={starting} onClose={() => setStarting(false)} title="New chat"
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={busy || !form.businessId || !form.text.trim()} onClick={start}>{busy ? 'Sending…' : 'Send message'}</button>}>
                <Field label="Business">
                    <select className="wp-input" value={form.businessId} autoFocus onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
                        <option value="">Choose a business…</option>
                        {(businesses || []).map((b: any) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                </Field>
                <Field label="Message"><textarea className="wp-input" rows={4} maxLength={2000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="The owner sees this in the app under Help & Support, with a notification." /></Field>
                {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
            </Modal>
        </div>
    );
}
