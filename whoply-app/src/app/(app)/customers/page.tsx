'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, MessageCircle, Check, Plus, Pencil, Trash2, Search, AlertTriangle, ReceiptText } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { maskGstin, isValidGstin, GSTIN_PLACEHOLDER } from '@/lib/gstin';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { useCan } from '@/lib/permissions';
import { buildUdharReminderText, whatsappLink } from '@/lib/bill';

const empty = { name: '', mobile: '', country: '+91', gstin: '', address: '', creditLimit: '' };
/** Udhar above the customer's limit (a limit of 0 means none). Shown as a warning only. */
const overLimit = (c: any) => c.creditLimit > 0 && c.creditBalance > c.creditLimit;
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

export default function CustomersPage() {
    const { user } = useAuth();
    const t = useT();
    const can = useCan();
    const qc = useQueryClient();
    const [dueOnly, setDueOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);

    const [detailId, setDetailId] = useState<string | null>(null);
    const [payFor, setPayFor] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [payMode, setPayMode] = useState<'cash' | 'upi' | 'card'>('cash');
    const [payErr, setPayErr] = useState('');
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [formErr, setFormErr] = useState('');
    const [del, setDel] = useState<any>(null);
    const [delErr, setDelErr] = useState('');
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    const { data, isLoading } = useQuery({
        queryKey: ['customers-page', dueOnly, q],
        queryFn: async () => (await api.get(`/shopkeeper/customers?limit=100${dueOnly ? '&hasDue=true' : ''}${q ? `&search=${encodeURIComponent(q)}` : ''}`)).data.data.items,
    });
    const { data: detail } = useQuery({
        queryKey: ['customer-ledger', detailId],
        queryFn: async () => (await api.get(`/shopkeeper/customers/${detailId}/ledger`)).data.data,
        enabled: !!detailId,
    });
    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['customers-page'] });
        qc.invalidateQueries({ queryKey: ['customer-ledger'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const remind = (c: any) => {
        if (!c.mobile) { alert(`No mobile number on file for ${c.name}. Add one to send a reminder.`); return; }
        window.open(whatsappLink(c.mobile, buildUdharReminderText(c.name, c.creditBalance, user?.business ? { name: user.business.name } : undefined), c.countryCode || '+91'), '_blank');
    };
    const openPay = (c: any) => { setPayFor(c); setAmount(String(c.creditBalance)); setPayMode('cash'); setPayErr(''); };
    const openNew = () => { setEditing(null); setForm({ ...empty, name: /\d/.test(search) ? '' : search.trim() }); setFormErr(''); setModal(true); };
    const openEdit = (c: any) => {
        setEditing(c);
        setForm({ name: c.name, mobile: c.mobile || '', country: c.countryCode || '+91', gstin: c.gstin || '', address: c.address || '', creditLimit: c.creditLimit ? String(c.creditLimit) : '' });
        setFormErr('');
        setModal(true);
    };

    const repay = useMutation({
        mutationFn: async () => (await api.post(`/shopkeeper/customers/${payFor._id}/repayment`, { amount: Number(amount), mode: payMode })).data.data,
        onSuccess: () => { setPayFor(null); setAmount(''); refresh(); },
        onError: (e) => setPayErr(apiErr(e)),
    });
    const save = useMutation({
        mutationFn: async () => {
            const body = { name: form.name, mobile: form.mobile, countryCode: form.country, gstin: form.gstin, address: form.address, creditLimit: Number(form.creditLimit) || 0 };
            if (editing) return (await api.patch(`/shopkeeper/customers/${editing._id}`, body)).data.data;
            return (await api.post('/shopkeeper/customers', body)).data.data;
        },
        onSuccess: (c: any) => { setModal(false); refresh(); if (!editing) setDetailId(c._id); },
        onError: (e) => setFormErr(apiErr(e)),
    });
    const remove = useMutation({
        mutationFn: async () => (await api.delete(`/shopkeeper/customers/${del._id}`)).data,
        onSuccess: () => { setDel(null); setDetailId(null); refresh(); },
        onError: (e) => setDelErr(apiErr(e)),
    });

    const gstinBad = form.gstin.length > 0 && !isValidGstin(form.gstin);
    const c = detail?.customer;
    const ledgerLabel: Record<string, string> = { credit: t('ledgerCredit'), repayment: t('ledgerRepayment'), return: t('ledgerReturn') };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('customersUdhar')}</h1>
                <div className="flex gap-2">
                    <button onClick={() => setDueOnly((v) => !v)} className="wp-btn wp-btn-ghost text-sm"
                        style={dueOnly ? { background: 'var(--warning-tint)', color: 'var(--warning)', borderColor: 'transparent' } : {}}>
                        <Wallet size={15} /> {t('withDuesOnly')}
                    </button>
                    {can('customers.manage') && <button className="wp-btn wp-btn-primary text-sm" onClick={openNew}><Plus size={16} /> {t('addCustomer')}</button>}
                </div>
            </div>

            <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="wp-input pl-11" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchCustomerPh')} aria-label={t('searchCustomerPh')} />
            </div>

            {!isLoading && (data || []).length === 0 && (
                <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{q || dueOnly ? t('noCustomersMatch') : t('noCustomersYet')}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((cu: any) => (
                    <motion.div key={cu._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="wp-card wp-card-hover p-4">
                        <button type="button" className="w-full text-left flex items-center gap-3" onClick={() => setDetailId(cu._id)}>
                            <div className="h-10 w-10 grid place-items-center rounded-full font-bold shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{cu.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cu.name}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{cu.mobile || t('noMobile')} · {cu.loyaltyPoints} {t('pts')}</p>
                            </div>
                            {overLimit(cu) && <span className="wp-chip shrink-0" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}><AlertTriangle size={11} /> {t('overLimit')}</span>}
                        </button>
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('udharBalance')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: cu.creditBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>{inr2(cu.creditBalance)}</p>
                            </div>
                            {cu.creditBalance > 0 && (
                                <div className="flex gap-1.5">
                                    <button className="wp-btn wp-btn-ghost !px-2.5 !py-2" title={t('sendReminderWa')} aria-label={t('sendReminderWa')} onClick={() => remind(cu)}>
                                        <MessageCircle size={15} style={{ color: 'var(--success)' }} />
                                    </button>
                                    {can('customers.manage') && (
                                        <button className="wp-btn wp-btn-collect !px-2.5 !py-2" title={t('recordRepayment')} aria-label={t('recordRepayment')} onClick={() => openPay(cu)}>
                                            <RupeeIcon size={15} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Customer detail: profile, udhar history, recent bills */}
            <Modal open={!!detailId} onClose={() => setDetailId(null)} title={c?.name || ''}
                footer={c && (
                    <div className="flex gap-2">
                        {c.creditBalance > 0 && can('customers.manage') && <button className="wp-btn wp-btn-primary flex-1" onClick={() => openPay(c)}><RupeeIcon size={15} /> {t('recordRepayment')}</button>}
                        {c.creditBalance > 0 && <button className="wp-btn wp-btn-ghost" onClick={() => remind(c)} aria-label={t('sendReminderWa')}><MessageCircle size={16} style={{ color: 'var(--success)' }} /></button>}
                        {can('customers.manage') && <button className="wp-btn wp-btn-ghost" onClick={() => openEdit(c)}><Pencil size={15} /> {t('edit')}</button>}
                        {/* Removing someone who still owes (or is owed) money would hide that balance. */}
                        {can('customers.delete') && Math.abs(c.creditBalance) < 0.01 && <button className="wp-btn wp-btn-ghost" onClick={() => { setDel(c); setDelErr(''); }} aria-label={t('remove')}><Trash2 size={15} style={{ color: 'var(--danger)' }} /></button>}
                    </div>
                )}>
                {!c ? <div className="h-40 animate-pulse rounded-xl" style={{ background: 'var(--surface-2)' }} /> : (
                    <div className="space-y-4">
                        <div className="text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                            <p>{c.mobile ? `${c.countryCode || '+91'} ${c.mobile}` : t('noMobile')}</p>
                            {c.gstin && <p>{t('gstin')}: <b className="tabular">{c.gstin}</b></p>}
                            {c.address && <p>{c.address}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('udharBalance')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: c.creditBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>{inr2(c.creditBalance)}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: overLimit(c) ? 'var(--danger-tint)' : 'var(--surface-2)' }}>
                                <p className="text-xs" style={{ color: overLimit(c) ? 'var(--danger)' : 'var(--text-muted)' }}>{t('udharLimitShort')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: overLimit(c) ? 'var(--danger)' : 'var(--text-primary)' }}>{c.creditLimit > 0 ? inr2(c.creditLimit) : '—'}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{t('udharHistory')}</h4>
                            {(detail.ledger || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noUdharEntries')}</p>}
                            {(detail.ledger || []).map((e: any, i: number) => {
                                const up = e.type === 'credit';
                                return (
                                    <div key={e._id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ledgerLabel[e.type] || e.type}</p>
                                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{day(e.createdAt)}{e.note ? ` · ${e.note}` : ''}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold tabular" style={{ color: up ? 'var(--warning)' : 'var(--success)' }}>{up ? '+' : '−'} {inr2(e.amount)}</p>
                                            <p className="text-[11px] tabular" style={{ color: 'var(--text-muted)' }}>{t('balanceAfter')} {inr2(e.balanceAfter)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{t('recentBills')}</h4>
                            {(detail.bills || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noBillsYet')}</p>}
                            {(detail.bills || []).map((b: any, i: number) => (
                                <div key={b._id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <ReceiptText size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.invoiceNo}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{day(b.createdAt)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(b.grandTotal)}</p>
                                        {b.dueAmount > 0
                                            ? <span className="wp-chip" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>{t('due')} {inr2(b.dueAmount)}</span>
                                            : <span className="wp-chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>{t('paid')}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add / edit customer */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('editCustomer') : t('addCustomer')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name.trim() || gstinBad} onClick={() => save.mutate()}>{editing ? t('save') : t('addCustomer')}</button>}>
                <Field label={t('customerNameLabel')}><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('customerNamePh')} maxLength={80} autoFocus /></Field>
                <Field label={`${t('mobile')} (${t('optionalWord')})`}><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(cc) => set('country', cc)} /></Field>
                <Field label={`${t('gstin')} (${t('optionalWord')})`}>
                    <input className="wp-input uppercase" value={form.gstin} maxLength={15} onChange={(e) => set('gstin', maskGstin(e.target.value))} placeholder={GSTIN_PLACEHOLDER} />
                    {form.gstin.length === 15 && gstinBad && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{t('gstinInvalid')}</p>}
                </Field>
                <Field label={`${t('addressLabel')} (${t('optionalWord')})`}><input className="wp-input" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} /></Field>
                <Field label={t('udharLimit')}>
                    <input className="wp-input tabular" type="number" inputMode="decimal" min={0} value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} placeholder="0" />
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('udharLimitHint')}</p>
                </Field>
                {formErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{formErr}</p>}
            </Modal>

            {/* Repayment */}
            <Modal open={!!payFor} onClose={() => setPayFor(null)} title={t('recordRepayment')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={repay.isPending || !Number(amount)} onClick={() => repay.mutate()}><Check size={16} /> {t('confirmRepayment')}</button>}>
                {payFor && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{payFor.name} · {t('udharBalance')} <b>{inr2(payFor.creditBalance)}</b></p>}
                <Field label={t('amountReceived')}><input className="wp-input tabular" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {(['cash', 'upi', 'card'] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={payMode === m} onClick={() => setPayMode(m)} className="py-2 rounded-lg text-xs font-semibold capitalize"
                            style={payMode === m ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{m}</button>
                    ))}
                </div>
                {payErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{payErr}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger
                title={t('removeCustomerTitle')} confirmLabel={t('remove')}
                message={delErr || t('removeCustomerMsg')} />
        </div>
    );
}
