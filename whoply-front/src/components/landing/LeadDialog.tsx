'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, Loader2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { getCopy, type Lang } from '@/i18n/landing';
import { API_URL } from '@/lib/links';
import { onLead, type LeadAsk } from '@/lib/lead';
import { YEARLY_DISCOUNT, type Plan } from './Pricing';

const blank = { name: '', mobile: '', businessName: '', businessType: 'retail', city: '', plan: '', billing: 'monthly', message: '', website: '' };
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * The "Start with Whoply" popup behind every Start free and plan button.
 * Nobody signs up on their own: the visitor sends their business details (and
 * the plan, if they picked one), it lands in the admin panel as a plan
 * request, and the team creates the account. Mounted once per page; opened
 * with openLead() from lib/lead.ts.
 */
export function LeadDialog({ lang, plans }: { lang: Lang; plans: Plan[] }) {
    const copy = getCopy(lang);
    const t = copy.lead;
    const f = copy.contact.form;
    const id = useId();
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(blank);
    const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState('');
    const panel = useRef<HTMLDivElement>(null);
    const first = useRef<HTMLInputElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const set = (k: keyof typeof blank, v: string) => setForm((cur) => ({ ...cur, [k]: v }));

    // A button somewhere on the page asked for the form.
    useEffect(
        () =>
            onLead((ask: LeadAsk) => {
                opener.current = document.activeElement as HTMLElement | null;
                setForm((cur) => ({
                    ...cur,
                    plan: ask.plan && plans.some((p) => p.key === ask.plan) ? ask.plan : cur.plan,
                    billing: ask.billing || cur.billing,
                    businessType: ask.role || cur.businessType,
                }));
                setState((s) => (s === 'sent' ? 'idle' : s));
                setError('');
                setOpen(true);
            }),
        [plans]
    );

    const close = () => {
        setOpen(false);
        opener.current?.focus?.();
    };

    // While open: the page behind does not scroll, Escape closes, Tab stays inside.
    useEffect(() => {
        if (!open) return;
        const root = document.documentElement;
        const before = root.style.overflow;
        root.style.overflow = 'hidden';
        const focusTimer = setTimeout(() => first.current?.focus(), 80);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key !== 'Tab' || !panel.current) return;
            const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea');
            if (!items.length) return;
            const head = items[0], tail = items[items.length - 1];
            if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
            else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            root.style.overflow = before;
            clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (state === 'sending') return;
        setState('sending');
        setError('');
        try {
            const res = await fetch(`${API_URL}/public/inquiries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: 'plan', name: form.name, mobile: form.mobile, businessName: form.businessName, businessType: form.businessType,
                    city: form.city, plan: form.plan || undefined, billing: form.plan ? form.billing : undefined, message: form.message, website: form.website, lang,
                }),
                signal: AbortSignal.timeout(15000),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || f.error);
                setState('idle');
                return;
            }
            setState('sent');
            setForm(blank);
        } catch {
            setError(f.error);
            setState('idle');
        }
    };

    const chosen = plans.find((p) => p.key === form.plan);
    const yearly = form.billing === 'yearly';
    const price = chosen ? (yearly ? chosen.price * (1 - YEARLY_DISCOUNT) : chosen.price) : 0;
    const field = 'mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text outline-none transition-colors placeholder:text-muted/70 focus:border-navy-light';
    const label = 'text-sm font-semibold text-navy';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div aria-hidden="true" className="absolute inset-0 bg-navy-dark/70 backdrop-blur-sm" onClick={close} />

                    <motion.div
                        ref={panel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`${id}-title`}
                        initial={reduce ? false : { y: 36, scale: 0.98 }}
                        animate={{ y: 0, scale: 1 }}
                        exit={reduce ? undefined : { y: 24, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="relative flex max-h-[94dvh] w-full max-w-[60rem] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl shadow-navy-dark/40 sm:rounded-3xl lg:grid lg:grid-cols-[0.8fr_1.2fr]"
                    >
                        {/* ── Brand side: what happens next, and the plan they picked ── */}
                        <div className="relative shrink-0 overflow-hidden bg-navy px-5 py-4 text-white sm:px-7 sm:py-5 lg:p-9">
                            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -bottom-28 hidden h-80 w-80 rounded-full bg-navy-light lg:block" />
                            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-14 hidden h-52 w-52 rounded-full border border-sand/25 lg:block" />
                            <div className="relative">
                                <Logo size={30} onNavy />
                                <h2 id={`${id}-title`} className="mt-3 font-display text-xl font-extrabold sm:text-2xl lg:mt-7 lg:text-[1.9rem] lg:leading-tight">
                                    {t.title}
                                </h2>
                                <p className="mt-1.5 hidden text-sm leading-relaxed text-white/75 sm:block lg:mt-3 lg:text-base">{t.sub}</p>
                                <ul className="mt-6 hidden space-y-3 lg:block">
                                    {t.points.map((p) => (
                                        <li key={p} className="flex items-start gap-3 text-[0.95rem] text-white/90">
                                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
                                                <Check size={12} strokeWidth={3} aria-hidden="true" />
                                            </span>
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                                {chosen && (
                                    <div className="mt-7 hidden rounded-2xl border border-white/15 bg-white/[0.08] p-4 lg:block">
                                        <p className="text-[11px] font-bold tracking-[0.14em] text-sand uppercase">{t.planLabel}</p>
                                        <p className="mt-1 font-display text-lg font-extrabold">{chosen.name}</p>
                                        <p className="tabular mt-0.5 text-sm text-white/80">
                                            {inr(price)}/{copy.pricing.per}
                                            {chosen.price > 0 && ` · ${yearly ? copy.pricing.yearly : copy.pricing.monthly}`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Form side ── */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7 lg:p-8">
                            {state === 'sent' ? (
                                <div className="grid h-full min-h-[18rem] place-items-center text-center" role="status">
                                    <div>
                                        <CheckCircle2 size={52} className="mx-auto text-success" aria-hidden="true" />
                                        <p className="mt-4 font-display text-2xl font-extrabold text-navy">{t.successTitle}</p>
                                        <p className="mx-auto mt-2 max-w-sm text-muted">{t.success}</p>
                                        <button type="button" className="btn btn-secondary mt-7" onClick={close}>
                                            {t.close}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor={`${id}-name`} className={label}>{f.name}</label>
                                        <input ref={first} id={`${id}-name`} className={field} required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
                                    </div>
                                    <div>
                                        <label htmlFor={`${id}-mobile`} className={label}>{f.mobile}</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute top-1/2 left-3.5 mt-[3px] -translate-y-1/2 text-base text-muted">+91</span>
                                            <input id={`${id}-mobile`} className={`${field} pl-12`} required inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10}
                                                value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor={`${id}-business`} className={label}>{t.businessName}</label>
                                        <input id={`${id}-business`} className={field} required minLength={2} maxLength={100} autoComplete="organization" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
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
                                    <div className={chosen && chosen.price > 0 ? '' : 'sm:col-span-2'}>
                                        <label htmlFor={`${id}-plan`} className={label}>{t.planLabel}</label>
                                        <select id={`${id}-plan`} className={field} value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                                            <option value="">{t.notSure}</option>
                                            {plans.map((p) => (
                                                <option key={p.key} value={p.key}>
                                                    {p.name} — {inr(p.price)}/{copy.pricing.per}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {chosen && chosen.price > 0 && (
                                        <div>
                                            <label htmlFor={`${id}-billing`} className={label}>{t.billing}</label>
                                            <select id={`${id}-billing`} className={field} value={form.billing} onChange={(e) => set('billing', e.target.value)}>
                                                <option value="monthly">{copy.pricing.monthly}</option>
                                                <option value="yearly">{copy.pricing.yearly} — {copy.pricing.save}</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="sm:col-span-2">
                                        <label htmlFor={`${id}-message`} className={label}>{t.messageOpt} <span className="font-normal text-muted">({f.optional})</span></label>
                                        <textarea id={`${id}-message`} className={`${field} resize-y`} maxLength={1000} rows={2} placeholder={t.messagePh} value={form.message} onChange={(e) => set('message', e.target.value)} />
                                    </div>
                                    {/* Not for people: left empty by anyone who can't see it. */}
                                    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                                        <label htmlFor={`${id}-website`}>Website</label>
                                        <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                                    </div>
                                    {error && <p className="rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm font-medium text-danger sm:col-span-2" role="alert">{error}</p>}
                                    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                                        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state === 'sending'}>
                                            {state === 'sending' ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> {f.sending}</> : <>{t.send} <ArrowRight size={17} aria-hidden="true" /></>}
                                        </button>
                                        <p className="text-xs text-muted sm:max-w-[16rem] sm:text-right">{f.privacy}</p>
                                    </div>
                                </form>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={close}
                            aria-label={t.close}
                            className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 lg:bg-surface-2 lg:text-navy lg:hover:bg-border"
                        >
                            <X size={19} aria-hidden="true" />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
