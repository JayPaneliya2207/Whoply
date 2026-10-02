'use client';

import { useId, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { API_URL, WHATSAPP_NUMBER, whatsappLink } from '@/lib/links';
import { Reveal } from './Reveal';

const empty = { name: '', mobile: '', email: '', businessType: 'retail', city: '', message: '', website: '' };

/**
 * "Contact us": what to expect on the left, the form on the right. The form
 * posts to the API's public inquiry route; the admin sees it under Inquiries.
 * `website` is a field people never see — form-filling bots fill it and the
 * API quietly drops those.
 */
export function Contact({ lang }: { lang: Lang }) {
    const t = getCopy(lang).contact;
    const f = t.form;
    const id = useId();
    const [form, setForm] = useState(empty);
    const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState('');
    const set = (k: keyof typeof empty, v: string) => setForm((cur) => ({ ...cur, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (state === 'sending') return;
        setState('sending');
        setError('');
        try {
            const res = await fetch(`${API_URL}/public/inquiries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, lang }),
                signal: AbortSignal.timeout(15000),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || f.error);
                setState('idle');
                return;
            }
            setState('sent');
            setForm(empty);
        } catch {
            setError(f.error);
            setState('idle');
        }
    };

    const field = 'mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text outline-none transition-colors placeholder:text-muted/70 focus:border-navy-light';
    const label = 'text-sm font-semibold text-navy';

    return (
        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <Reveal className="rounded-3xl bg-navy p-7 text-white sm:p-9">
                <ul className="space-y-4">
                    {t.points.map((p) => (
                        <li key={p} className="flex items-start gap-3">
                            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15">
                                <Check size={14} aria-hidden="true" />
                            </span>
                            <span className="text-base leading-relaxed text-white/90">{p}</span>
                        </li>
                    ))}
                </ul>
                {WHATSAPP_NUMBER && (
                    <a href={whatsappLink(t.whatsappMsg)} target="_blank" rel="noreferrer" className="btn mt-8 bg-white text-navy hover:bg-sand">
                        <MessageCircle size={18} aria-hidden="true" /> {t.whatsapp}
                    </a>
                )}
                <p className="mt-8 text-sm text-white/60">{f.privacy}</p>
            </Reveal>

            <Reveal delay={120} className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-navy/5 sm:p-8">
                {state === 'sent' ? (
                    <div className="grid h-full place-items-center py-10 text-center" role="status">
                        <div>
                            <CheckCircle2 size={48} className="mx-auto text-success" aria-hidden="true" />
                            <p className="mt-4 font-display text-2xl font-extrabold text-navy">{f.successTitle}</p>
                            <p className="mt-2 text-muted">{f.success}</p>
                            <button type="button" className="mt-6 text-sm font-semibold text-accent-strong underline underline-offset-4" onClick={() => setState('idle')}>
                                {f.again}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} noValidate={false} className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor={`${id}-name`} className={label}>{f.name}</label>
                            <input id={`${id}-name`} className={field} required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor={`${id}-mobile`} className={label}>{f.mobile}</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-base text-muted">+91</span>
                                <input id={`${id}-mobile`} className={`${field} pl-12`} required inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10}
                                    value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor={`${id}-type`} className={label}>{f.type}</label>
                            <select id={`${id}-type`} className={field} value={form.businessType} onChange={(e) => set('businessType', e.target.value)}>
                                <option value="retail">{f.typeRetail}</option>
                                <option value="wholesale">{f.typeWholesale}</option>
                                <option value="other">{f.typeOther}</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={`${id}-city`} className={label}>{f.city} <span className="font-normal text-muted">({f.optional})</span></label>
                            <input id={`${id}-city`} className={field} maxLength={60} autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor={`${id}-email`} className={label}>{f.email} <span className="font-normal text-muted">({f.optional})</span></label>
                            <input id={`${id}-email`} type="email" className={field} maxLength={120} autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor={`${id}-message`} className={label}>{f.message}</label>
                            <textarea id={`${id}-message`} className={`${field} resize-y`} required minLength={5} maxLength={1000} rows={4} placeholder={f.messagePh} value={form.message} onChange={(e) => set('message', e.target.value)} />
                        </div>
                        {/* Not for people: left empty by anyone who can't see it. */}
                        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                            <label htmlFor={`${id}-website`}>Website</label>
                            <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                        </div>
                        {error && <p className="rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm font-medium text-danger sm:col-span-2" role="alert">{error}</p>}
                        <div className="sm:col-span-2">
                            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state === 'sending'}>
                                {state === 'sending' ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> {f.sending}</> : <>{f.send} <ArrowRight size={17} aria-hidden="true" /></>}
                            </button>
                        </div>
                    </form>
                )}
            </Reveal>
        </div>
    );
}
