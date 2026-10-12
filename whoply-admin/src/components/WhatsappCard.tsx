'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle2, Loader2, MessageCircle, Save, Send } from 'lucide-react';
import { api, apiErr } from '@/lib/api';

interface Saved { enabled: boolean; from: string; apiUrl: string; tokenSet: boolean; ready: boolean }
interface Form { enabled: boolean; from: string; apiUrl: string; token: string }

function F({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return <label className={`block ${className}`}><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span><div className="mt-1.5">{children}</div></label>;
}

/**
 * The WhatsApp gateway (Whatsline) that sends sign-in codes: on/off, the sender
 * number, the token, and a test message. It saves on its own — the token is
 * write-only, so it never travels with the other settings.
 */
export function WhatsappCard() {
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ['admin-whatsapp'], queryFn: async () => (await api.get('/admin/whatsapp')).data.data as Saved });
    const [form, setForm] = useState<Form | null>(null);
    const [err, setErr] = useState('');
    const [saved, setSaved] = useState(false);
    const [advanced, setAdvanced] = useState(false);
    const [testTo, setTestTo] = useState('');
    const [test, setTest] = useState<{ ok: boolean; detail: string; to: string } | null>(null);
    const fill = (d: Saved) => setForm({ enabled: d.enabled, from: d.from, apiUrl: d.apiUrl, token: '' });
    useEffect(() => { if (data && !form) fill(data); }, [data, form]);
    const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

    const save = useMutation({
        mutationFn: async () => (await api.put('/admin/whatsapp', { enabled: form!.enabled, from: form!.from, apiUrl: form!.apiUrl, ...(form!.token && { token: form!.token }) })).data.data as Saved,
        onSuccess: (d) => { setErr(''); qc.setQueryData(['admin-whatsapp'], d); fill(d); setSaved(true); setTimeout(() => setSaved(false), 2500); },
        onError: (e) => setErr(apiErr(e)),
    });
    const sendTest = useMutation({
        mutationFn: async () => (await api.post('/admin/whatsapp/test', { mobile: testTo })).data.data,
        onSuccess: (d) => { setErr(''); setTest(d); },
        onError: (e) => { setTest(null); setErr(apiErr(e)); },
    });

    if (!data || !form) return <div className="wp-card h-40 animate-pulse" />;
    const dirty = form.enabled !== data.enabled || form.from !== data.from || form.apiUrl !== data.apiUrl || !!form.token;
    const state = data.ready ? { text: 'On', style: { background: 'var(--success-tint)', color: 'var(--success)' } }
        : data.from && data.tokenSet ? { text: 'Off', style: { background: 'var(--warning-tint)', color: 'var(--warning)' } }
            : { text: 'Not set up', style: { background: 'var(--surface-2)', color: 'var(--text-secondary)' } };

    return (
        <div className="wp-card p-5">
            <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 grid place-items-center rounded-xl shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><MessageCircle size={18} /></div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold flex flex-wrap items-center gap-2" style={{ color: 'var(--text-primary)' }}>WhatsApp sign-in codes <span className="wp-chip" style={state.style}>{state.text}</span></h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sends the OTP on WhatsApp through your Whatsline account. While this is on, the app’s sign-in page offers “OTP Login” next to the password.</p>
                </div>
            </div>

            <label className="flex items-start gap-3 mb-4 cursor-pointer">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                <span><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Send sign-in codes on WhatsApp</span><br /><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Fill in the two boxes below and send a test message first.</span></span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
                <F label="Sender WhatsApp number (the one linked in Whatsline)">
                    <input className="wp-input tabular" value={form.from} onChange={(e) => set({ from: e.target.value })} placeholder="919876543210" maxLength={20} inputMode="numeric" />
                </F>
                <F label="Whatsline token">
                    <input className="wp-input" type="password" value={form.token} onChange={(e) => set({ token: e.target.value })} maxLength={500} autoComplete="new-password"
                        placeholder={data.tokenSet ? 'Saved — type a new one to replace it' : 'Paste the token from Whatsline'} />
                </F>
                {advanced && (
                    <F label="API address (change only if Whatsline gives you another one)" className="sm:col-span-2">
                        <input className="wp-input" value={form.apiUrl} onChange={(e) => set({ apiUrl: e.target.value })} maxLength={300} />
                    </F>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <button className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }} onClick={() => setAdvanced((v) => !v)}>{advanced ? 'Hide the API address' : 'Show the API address'}</button>
                <button className="wp-btn wp-btn-primary" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>{saved && !dirty ? <><Check size={16} /> Saved</> : <><Save size={16} /> {save.isPending ? 'Saving…' : 'Save WhatsApp settings'}</>}</button>
            </div>

            <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Try it</p>
                <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Sends one short test message with what is saved above. It works before the switch is on.</p>
                <div className="flex flex-wrap gap-2">
                    <input className="wp-input tabular flex-1 min-w-[200px]" value={testTo} onChange={(e) => setTestTo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && testTo && !dirty && sendTest.mutate()} placeholder="Your own WhatsApp number" maxLength={20} inputMode="numeric" aria-label="Number to send the test message to" />
                    <button className="wp-btn wp-btn-ghost" disabled={sendTest.isPending || !testTo.trim() || dirty || !data.tokenSet || !data.from} onClick={() => sendTest.mutate()}>{sendTest.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send test message</button>
                </div>
                {dirty && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Save your changes first — the test uses what is saved.</p>}
                {test && (
                    <p className="flex items-start gap-2 text-sm mt-3" style={{ color: test.ok ? 'var(--success)' : 'var(--danger)' }} role="status">
                        {test.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                        <span>{test.ok ? `Whatsline accepted the message for ${test.to}. Check that phone — if nothing arrives, the sender phone is not connected in Whatsline.` : `Not sent. ${test.detail}`}</span>
                    </p>
                )}
            </div>
            {err && <p className="flex items-start gap-2 text-sm mt-3" style={{ color: 'var(--danger)' }} role="alert"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {err}</p>}
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>Whatsline sends from a WhatsApp number linked by QR code, so that phone must stay online. If it disconnects, codes stop arriving and people sign in with their password until it is linked again.</p>
        </div>
    );
}
