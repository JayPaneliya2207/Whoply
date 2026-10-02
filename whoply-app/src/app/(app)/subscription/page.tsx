'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, QrCode, Landmark, MessageCircle, ReceiptText, Check, Clock, AlertTriangle, Crown } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useT } from '@/i18n';
import { UpiQr } from '@/components/UpiQr';
import { whatsappLink } from '@/lib/bill';

const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
/** The stored period end is the next period's first day — show the last day instead. */
const period = (b: any) => `${day(b.periodStart)} – ${day(new Date(+new Date(b.periodEnd) - 864e5).toISOString())}`;

/** The owner's Whoply plan, the bills Whoply sent, and how to pay them. */
export default function SubscriptionPage() {
    const t = useT();
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['subscription'], queryFn: async () => (await api.get('/subscription')).data.data });
    const [qrFor, setQrFor] = useState<any>(null);
    const [claimFor, setClaimFor] = useState<string | null>(null);
    const [ref, setRef] = useState('');
    const [err, setErr] = useState('');

    const claim = useMutation({
        mutationFn: async (id: string) => (await api.post(`/subscription/bills/${id}/claim`, { ref })).data,
        onSuccess: () => { setClaimFor(null); setRef(''); setErr(''); qc.invalidateQueries({ queryKey: ['subscription'] }); },
        onError: (e) => setErr(apiErr(e)),
    });

    if (isLoading || !data) return <div className="space-y-3 max-w-2xl">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="wp-card h-24 animate-pulse" />)}</div>;

    const { plan, payTo, support } = data;
    const due: any[] = data.bills.filter((b: any) => b.status === 'due');
    const paid: any[] = data.bills.filter((b: any) => b.status === 'paid');
    const hasBank = !!(payTo?.bank?.account && payTo?.bank?.ifsc);

    return (
        <div className="space-y-4 max-w-2xl">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('subscription')}</h1>

            {/* Plan */}
            <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'var(--brand)', color: '#fff' }}>
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="flex items-center gap-2 text-sm" style={{ opacity: 0.9 }}><Crown size={16} /> {t('yourPlan')}</div>
                <p className="text-2xl font-extrabold mt-1">{plan.name}</p>
                <p className="text-sm mt-0.5" style={{ opacity: 0.85 }}>
                    {plan.price > 0 ? `${inr2(plan.price)} / ${plan.period === 'year' ? t('yearWord') : t('monthWord')}` : t('freePlanNote')}
                    {data.paidUntil && ` · ${t('paidUntil')} ${day(new Date(+new Date(data.paidUntil) - 864e5).toISOString())}`}
                </p>
            </div>

            {/* Bills to pay */}
            <div className="wp-card p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><ReceiptText size={17} style={{ color: 'var(--brand-text)' }} /> {t('billsToPay')}</h3>
                {!due.length && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--success)' }}><BadgeCheck size={16} /> {t('noBillsDue')}</p>}
                <div className="space-y-3">
                    {due.map((b) => (
                        <div key={b._id} className="rounded-xl p-3.5" style={{ background: 'var(--surface-2)' }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{b.planName} · {b.billNo}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{period(b)}</p>
                                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: b.overdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                        {b.overdue ? <AlertTriangle size={12} /> : <Clock size={12} />} {b.overdue ? t('overdueSince') : t('dueOn')} {day(b.dueDate)}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-lg font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>{inr2(b.total)}</p>
                                    {b.gstAmount > 0 && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('inclGst')} {inr2(b.gstAmount)}</p>}
                                </div>
                            </div>
                            {b.claimedAt ? (
                                <p className="text-xs mt-3 flex items-center gap-1.5 font-medium" style={{ color: 'var(--success)' }}><Check size={14} /> {t('payConfirming')}{b.claimRef ? ` (${b.claimRef})` : ''}</p>
                            ) : claimFor === b._id ? (
                                <div className="mt-3 flex gap-2">
                                    <input className="wp-input !py-2 flex-1" placeholder={t('upiRefPh')} value={ref} maxLength={60} onChange={(e) => setRef(e.target.value)} autoFocus />
                                    <button className="wp-btn wp-btn-primary shrink-0" disabled={claim.isPending} onClick={() => claim.mutate(b._id)}><Check size={15} /> {t('confirmWord')}</button>
                                </div>
                            ) : (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {payTo?.upiId && <button className="wp-btn wp-btn-primary" onClick={() => setQrFor(b)}><QrCode size={15} /> {t('payWithUpi')}</button>}
                                    <button className="wp-btn wp-btn-ghost" onClick={() => { setClaimFor(b._id); setRef(''); setErr(''); }}><Check size={15} /> {t('iHavePaid')}</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {err && <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{err}</p>}
                {due.length > 0 && !payTo?.upiId && !hasBank && <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{t('askSupportToPay')}</p>}
            </div>

            {/* Bank transfer */}
            {due.length > 0 && hasBank && (
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Landmark size={17} style={{ color: 'var(--brand-text)' }} /> {t('bankTransfer')}</h3>
                    <div className="text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        <p>{payTo.bank.holder || payTo.company}</p>
                        <p className="tabular">{payTo.bank.name} · A/C {payTo.bank.account}</p>
                        <p className="tabular">IFSC {payTo.bank.ifsc}</p>
                    </div>
                </div>
            )}

            {/* Paid bills */}
            {paid.length > 0 && (
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('billHistory')}</h3>
                    {paid.map((b, i) => (
                        <div key={b._id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.planName} · {b.billNo}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{period(b)}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(b.total)}</p>
                                <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>{t('paidWord')} {b.paidAt ? day(b.paidAt) : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Help */}
            {(support?.whatsapp || support?.email) && (
                <div className="wp-card p-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('needHelp')}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{[support.email, support.hours].filter(Boolean).join(' · ') || t('whoplySupport')}</p>
                    </div>
                    <Link href="/support" className="wp-btn wp-btn-ghost"><MessageCircle size={15} /> {t('chatWithUs')}</Link>
                    {support.whatsapp && <a className="wp-btn wp-btn-collect" target="_blank" rel="noreferrer" href={whatsappLink(support.whatsapp.slice(-10), 'Hello Whoply support,', support.whatsapp.length > 10 ? `+${support.whatsapp.slice(0, -10)}` : '+91')}><MessageCircle size={15} /> WhatsApp</a>}
                </div>
            )}

            {qrFor && <UpiQr amount={qrFor.total} upiId={payTo.upiId} shopName={payTo.company} onClose={() => setQrFor(null)} />}
        </div>
    );
}
