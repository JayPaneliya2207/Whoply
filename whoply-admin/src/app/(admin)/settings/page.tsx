'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, IndianRupee, BellRing, LifeBuoy, MessageSquareText, Check, Save } from 'lucide-react';
import { api, apiErr } from '@/lib/api';

function Section({ title, hint, icon: Icon, children }: { title: string; hint: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="wp-card p-5">
            <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 grid place-items-center rounded-xl shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><Icon size={18} /></div>
                <div><h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{hint}</p></div>
            </div>
            {children}
        </div>
    );
}
function F({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return <label className={`block ${className}`}><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span><div className="mt-1.5">{children}</div></label>;
}

/** Platform settings: who issues subscription bills, how they are paid, reminders, support contact, message wording. */
export default function SettingsPage() {
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get('/admin/settings')).data.data });
    const [s, setS] = useState<any>(null);
    const [err, setErr] = useState('');
    const [saved, setSaved] = useState(false);
    useEffect(() => { if (data && !s) setS(JSON.parse(JSON.stringify(data))); }, [data, s]);

    /** set('billing.bank.ifsc', 'HDFC0001') */
    const set = (path: string, v: any) => setS((cur: any) => {
        const next = JSON.parse(JSON.stringify(cur));
        const keys = path.split('.');
        let o = next;
        for (const k of keys.slice(0, -1)) o = o[k] ||= {};
        o[keys[keys.length - 1]] = v;
        return next;
    });
    const save = useMutation({
        mutationFn: async () => (await api.put('/admin/settings', { company: s.company, billing: s.billing, support: s.support, templates: s.templates })).data.data,
        onSuccess: (d) => { setErr(''); setS(JSON.parse(JSON.stringify(d))); qc.setQueryData(['admin-settings'], d); setSaved(true); setTimeout(() => setSaved(false), 2500); },
        onError: (e) => setErr(apiErr(e)),
    });

    if (!s) return <div className="space-y-4 max-w-3xl">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="wp-card h-40 animate-pulse" />)}</div>;
    const text = (path: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
        const value = path.split('.').reduce((o: any, k) => o?.[k], s) ?? '';
        return <input className="wp-input" value={value} onChange={(e) => set(path, e.target.value)} {...props} />;
    };

    return (
        <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Subscription bills, payment details, reminders and support contact.</p>
                </div>
                <button className="wp-btn wp-btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> {save.isPending ? 'Saving…' : 'Save settings'}</>}</button>
            </div>
            {err && <div className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>{err}</div>}

            <Section title="Your company" hint="Printed at the top of every subscription bill." icon={Building2}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <F label="Company name">{text('company.name', { maxLength: 120 })}</F>
                    <F label="GSTIN (leave empty if not registered)">{text('company.gstin', { maxLength: 15, placeholder: '22AAAAA0000A1Z5', className: 'wp-input uppercase' })}</F>
                    <F label="Address" className="sm:col-span-2">{text('company.address', { maxLength: 300 })}</F>
                    <F label="Email">{text('company.email', { type: 'email', maxLength: 120 })}</F>
                    <F label="Phone">{text('company.phone', { maxLength: 20 })}</F>
                </div>
            </Section>

            <Section title="Billing and payment" hint="How bills are worked out, and where owners send the money." icon={IndianRupee}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <F label="GST % on bills">{text('billing.gstRate', { type: 'number', min: 0, max: 28 })}</F>
                    <F label="Days to pay (due date)">{text('billing.dueDays', { type: 'number', min: 0, max: 60 })}</F>
                    <F label="UPI ID (owners scan a QR for this)" className="sm:col-span-2">{text('billing.upiId', { placeholder: 'yourname@bank', maxLength: 80 })}</F>
                    <F label="Bank name">{text('billing.bank.name', { maxLength: 80 })}</F>
                    <F label="Account holder">{text('billing.bank.holder', { maxLength: 80 })}</F>
                    <F label="Account number">{text('billing.bank.account', { maxLength: 30 })}</F>
                    <F label="IFSC">{text('billing.bank.ifsc', { maxLength: 11, className: 'wp-input uppercase' })}</F>
                </div>
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{s.company.gstin ? `GST of ${s.billing.gstRate}% is added to every bill.` : 'GST is added to bills only once your GSTIN is filled in above.'}</p>
            </Section>

            <Section title="Reminders" hint="Owners are reminded inside the app. WhatsApp messages open ready to send from the Billing page." icon={BellRing}>
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={!!s.billing.autoBill} onChange={(e) => set('billing.autoBill', e.target.checked)} />
                    <span><span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bill everyone automatically</span><br /><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Every morning, businesses on a paid plan whose last bill period has ended get their next bill.</span></span>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                    <F label="Remind this many days before the due date">{text('billing.remindDaysBefore', { type: 'number', min: 0, max: 30 })}</F>
                    <F label="When overdue, remind every (days)">{text('billing.remindOverdueEvery', { type: 'number', min: 1, max: 30 })}</F>
                </div>
            </Section>

            <Section title="Support contact" hint="Shown to owners on their Subscription page." icon={LifeBuoy}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <F label="Support WhatsApp number">{text('support.whatsapp', { placeholder: '10-digit mobile', maxLength: 15, inputMode: 'numeric' })}</F>
                    <F label="Support email">{text('support.email', { type: 'email', maxLength: 120 })}</F>
                    <F label="Support hours" className="sm:col-span-2">{text('support.hours', { placeholder: 'Mon–Sat, 10 am – 7 pm', maxLength: 80 })}</F>
                </div>
            </Section>

            <Section title="Message wording" hint="Used for the WhatsApp bill and reminder messages." icon={MessageSquareText}>
                <F label="New bill message"><textarea className="wp-input" rows={3} maxLength={600} value={s.templates.bill} onChange={(e) => set('templates.bill', e.target.value)} /></F>
                <F label="Reminder message" className="mt-3"><textarea className="wp-input" rows={3} maxLength={600} value={s.templates.reminder} onChange={(e) => set('templates.reminder', e.target.value)} /></F>
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>These words are filled in for each bill: <code>{'{owner}'}</code> <code>{'{business}'}</code> <code>{'{plan}'}</code> <code>{'{billNo}'}</code> <code>{'{amount}'}</code> <code>{'{period}'}</code> <code>{'{dueDate}'}</code>. Your UPI ID is added at the end.</p>
            </Section>
        </div>
    );
}
