'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, LifeBuoy, CheckCheck, Loader2 } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { useT } from '@/i18n';

interface Msg { _id: string; from: 'business' | 'admin'; senderName: string; text: string; createdAt: string }

const timeOf = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayOf = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const QUICK = ['supportQuick1', 'supportQuick2', 'supportQuick3'];

/**
 * Chat with the Whoply team — one running conversation for the business.
 * New replies are fetched every few seconds while the screen is open.
 */
export default function SupportPage() {
    const t = useT();
    const [messages, setMessages] = useState<Msg[]>([]);
    const [status, setStatus] = useState('open');
    const [hours, setHours] = useState('');
    const [ready, setReady] = useState(false);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [err, setErr] = useState('');
    const last = useRef(''); // createdAt of the newest message we have
    const endRef = useRef<HTMLDivElement>(null);

    const add = (incoming: Msg[]) => setMessages((prev) => {
        const have = new Set(prev.map((m) => m._id));
        const fresh = incoming.filter((m) => !have.has(m._id));
        return fresh.length ? [...prev, ...fresh] : prev;
    });

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/support' + (last.current ? `?after=${encodeURIComponent(last.current)}` : ''));
            const d = data.data;
            setStatus(d.status);
            setHours(d.support?.hours || '');
            if (d.messages.length) {
                add(d.messages);
                last.current = d.messages[d.messages.length - 1].createdAt;
            }
        } catch { /* offline for a moment — the next tick tries again */ }
        setReady(true);
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(() => { if (!document.hidden) load(); }, 4000);
        return () => clearInterval(id);
    }, [load]);
    useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

    const send = async (body = text) => {
        if (!body.trim() || sending) return;
        setSending(true); setErr('');
        try {
            const { data } = await api.post('/support/messages', { text: body });
            add([data.data]);
            if (data.data.createdAt > last.current) last.current = data.data.createdAt;
            setText(''); setStatus('open');
        } catch (e) { setErr(apiErr(e)); }
        setSending(false);
    };

    return (
        <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 190px)' }}>
            {/* Who you're talking to */}
            <div className="wp-card p-3.5 flex items-center gap-3 mb-3">
                <div className="h-11 w-11 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--brand)', color: '#fff' }}><LifeBuoy size={20} /></div>
                <div className="min-w-0">
                    <p className="font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{t('whoplySupport')}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{hours || t('supportReplyTime')}</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-2 pb-3">
                {!ready && <div className="grid place-items-center py-16" style={{ color: 'var(--text-muted)' }}><Loader2 size={22} className="animate-spin" /></div>}
                {ready && !messages.length && (
                    <div className="text-center py-10 px-4">
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('supportIntro')}</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {QUICK.map((k) => <button key={k} className="wp-chip !text-sm !px-3 !py-1.5" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }} onClick={() => setText(t(k) + ' ')}>{t(k)}</button>)}
                        </div>
                    </div>
                )}
                {messages.map((m, i) => {
                    const mine = m.from === 'business';
                    const newDay = i === 0 || dayOf(messages[i - 1].createdAt) !== dayOf(m.createdAt);
                    return (
                        <div key={m._id}>
                            {newDay && <p className="text-center my-3"><span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{dayOf(m.createdAt)}</span></p>}
                            <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[82%] px-3.5 py-2 rounded-2xl ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                                    style={mine ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                                    <p className="text-[11px] font-semibold mb-0.5" style={{ opacity: 0.75 }}>{mine ? m.senderName : t('whoplySupport')}</p>
                                    <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                                    <p className="text-[10px] text-right mt-1 tabular" style={{ opacity: 0.7 }}>{timeOf(m.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {status === 'resolved' && messages.length > 0 && <p className="text-center text-xs py-2 flex items-center justify-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCheck size={14} /> {t('supportSolved')}</p>}
                <div ref={endRef} />
            </div>

            {/* Composer — stays above the bottom tabs */}
            <div className="sticky z-10 pt-2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 78px)' }}>
                {err && <p className="text-sm mb-1.5 px-1" style={{ color: 'var(--danger)' }}>{err}</p>}
                <div className="wp-card p-2 flex items-end gap-2" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <textarea className="wp-input !border-0 !shadow-none flex-1 resize-none" rows={1} maxLength={2000} placeholder={t('typeMessage')} value={text}
                        style={{ maxHeight: 120 }} onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <button className="wp-btn wp-btn-primary !p-3 shrink-0" aria-label={t('sendWord')} disabled={!text.trim() || sending} onClick={() => send()}>
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
