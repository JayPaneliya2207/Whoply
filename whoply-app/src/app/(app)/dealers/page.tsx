'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, Check, MessageCircle, Plus, Pencil, Trash2, QrCode, MapPin, UserRound } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api, apiErr } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';
import { inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { useT } from '@/i18n';
import { useCan } from '@/lib/permissions';
import { UpiQr } from '@/components/UpiQr';
import { VisitModal } from '@/components/VisitModal';
import { buildDealerPaymentText, whatsappLink } from '@/lib/bill';
import { GSTIN_PLACEHOLDER, maskGstin, isValidGstin } from '@/lib/gstin';

const tierTone: Record<string, any> = {
    A: { background: 'var(--success-tint)', color: 'var(--success)' },
    B: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    C: { background: 'var(--warning-tint)', color: 'var(--warning)' },
};
// "tier" renamed to a friendly Price Group for clarity
const groupKey: Record<string, string> = { A: 'tierPremium', B: 'tierStandard', C: 'tierBasic' };
const empty = { name: '', shopName: '', mobile: '', country: '+91', gstin: '', tier: 'B', city: '', creditLimit: '100000', assignedRepId: '' };

export default function DealersPage() {
    const qc = useQueryClient();
    const t = useT();
    const can = useCan();
    const [showQr, setShowQr] = useState(false);
    const { data: biz } = useQuery({ queryKey: ['ws-business'], queryFn: async () => (await api.get('/wholesaler/business')).data.data });
    // Remind a dealer on WhatsApp — includes how to pay (UPI + bank details).
    const remindDealer = (d: any) => {
        if (!d.mobile) { alert('Add a mobile number for this dealer to send a reminder.'); return; }
        window.open(whatsappLink(d.mobile, buildDealerPaymentText(d.name, d.outstandingBalance, biz), d.countryCode || '+91'), '_blank');
    };
    const [collectFor, setCollectFor] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [payMode, setPayMode] = useState('cash');
    const [collectErr, setCollectErr] = useState('');

    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [formErr, setFormErr] = useState('');
    const [del, setDel] = useState<any>(null);
    const [visitFor, setVisitFor] = useState<any>(null);
    // A sales rep can narrow the list to the dealers they look after.
    const isRep = can('visits.record') && !can('team.view');
    const me = useAuth((s) => s.user);
    // A rep edits, removes and collects only for the dealers assigned to them.
    const mine = (d: any) => !isRep || String(d.assignedRepId || '') === String(me?.id || '');
    const setsMoney = can('team.view'); // price group and credit limit: owner / manager only
    const [mineOnly, setMineOnly] = useState(false);

    const { data } = useQuery({ queryKey: ['dealers', mineOnly], queryFn: async () => (await api.get(`/wholesaler/dealers?limit=100${mineOnly ? '&mine=true' : ''}`)).data.data.items });
    // Reps to assign a dealer to — only the owner / manager choose.
    const { data: reps } = useQuery({ queryKey: ['reps'], queryFn: async () => (await api.get('/wholesaler/sales-team')).data.data, enabled: can('team.view') });

    const openNew = () => { setEditing(null); setForm(empty); setFormErr(''); setModal(true); };
    const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, shopName: d.shopName || '', mobile: d.mobile || '', country: d.countryCode || '+91', gstin: d.gstin || '', tier: d.tier, city: d.city || '', creditLimit: d.creditLimit, assignedRepId: d.assignedRepId ? String(d.assignedRepId) : '' }); setFormErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            const { country, assignedRepId, ...rest } = form;
            const body = { ...rest, countryCode: country, creditLimit: Number(form.creditLimit) || 0, ...(can('team.view') && { assignedRepId: assignedRepId || null }) };
            if (editing) return (await api.patch(`/wholesaler/dealers/${editing._id}`, body)).data.data;
            return (await api.post('/wholesaler/dealers', body)).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['dealers'] }); },
        onError: (e) => setFormErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/wholesaler/dealers/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['dealers'] }); },
        onError: (e) => { setDel(null); alert(apiErr(e)); },
    });
    const collect = useMutation({
        mutationFn: async () => (await api.post(`/wholesaler/dealers/${collectFor._id}/collect`, { amount: Number(amount), mode: payMode })).data.data,
        onSuccess: () => {
            setCollectFor(null); setAmount(''); setPayMode('cash'); setCollectErr('');
            qc.invalidateQueries({ queryKey: ['dealers'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['payments'] });
            qc.invalidateQueries({ queryKey: ['ws-tally'] });
        },
        onError: (e) => setCollectErr(apiErr(e)),
    });

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('dealersTitle')}</h1>
                <div className="flex gap-2">
                    {isRep && (
                        <button onClick={() => setMineOnly((v) => !v)} className="wp-btn wp-btn-ghost text-sm" aria-pressed={mineOnly}
                            style={mineOnly ? { background: 'var(--brand-tint)', color: 'var(--brand-text)', borderColor: 'transparent' } : {}}>
                            <UserRound size={15} /> {t('myDealers')}
                        </button>
                    )}
                    {can('dealers.manage') && <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> {t('addDealer')}</button>}
                </div>
            </div>

            {(data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noDealersYet')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((d: any) => (
                    <motion.div key={d._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="wp-card wp-card-hover p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><Building2 size={18} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.city || '—'} · {d.mobile}</p>
                                {d.assignedRepName && <p className="text-xs flex items-center gap-1 mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}><UserRound size={11} className="shrink-0" /> {d.assignedRepName}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="wp-chip" style={tierTone[d.tier]}>{t(groupKey[d.tier])}</span>
                                {d.creditLimit > 0 && d.outstandingBalance > d.creditLimit && <span className="wp-chip" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>{t('overCreditLimit')}</span>}
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('outstandingWord')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: d.outstandingBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>{inr2(d.outstandingBalance)}</p>
                            </div>
                            <div className="flex gap-1.5">
                                {can('visits.record') && <button className="wp-btn wp-btn-ghost !p-2" title={t('logVisit')} aria-label={`${t('logVisit')} · ${d.name}`} onClick={() => setVisitFor(d)}><MapPin size={14} /></button>}
                                {can('dealers.manage') && mine(d) && <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(d)}><Pencil size={14} /></button>}
                                {can('dealers.delete') && mine(d) && <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(d)}><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>}
                                {d.outstandingBalance > 0 && (
                                    <>
                                        <button className="wp-btn wp-btn-ghost !p-2" title="Send WhatsApp payment reminder" onClick={() => remindDealer(d)}><MessageCircle size={14} style={{ color: 'var(--success)' }} /></button>
                                        {can('payments.collect') && mine(d) && <button className="wp-btn wp-btn-collect !p-2" onClick={() => { setCollectFor(d); setAmount(String(d.outstandingBalance)); }}><RupeeIcon size={14} /></button>}
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <VisitModal open={!!visitFor} dealer={visitFor || undefined} onClose={() => setVisitFor(null)} />

            {/* Add/Edit dealer */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('editDealer') : t('addDealer')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>{editing ? t('save') : t('addDealer')}</button>}>
                <Field label={t('dealerNameLabel')}><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ravi Traders" autoFocus /></Field>
                <Field label={t('shopNameLabel')}><input className="wp-input" value={form.shopName} onChange={(e) => set('shopName', e.target.value)} placeholder="e.g. Ravi Kirana Store" /></Field>
                <Field label={t('mobile')}><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(c) => set('country', c)} /></Field>
                <Field label={`${t('gstin')} (${t('optionalWord')})`}>
                    <input className="wp-input uppercase" value={form.gstin} maxLength={15} onChange={(e) => set('gstin', maskGstin(e.target.value))} placeholder={GSTIN_PLACEHOLDER} />
                    {form.gstin.length === 15 && !isValidGstin(form.gstin) && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{t('gstinInvalid')}</p>}
                </Field>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={t('priceGroup')}><select className="wp-input" value={form.tier} disabled={!setsMoney} onChange={(e) => set('tier', e.target.value)}><option value="A">{t('premiumBest')}</option><option value="B">{t('tierStandard')}</option><option value="C">{t('tierBasic')}</option></select></Field>
                    <Field label={t('cityLabel')}><input className="wp-input" value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
                    <Field label={t('creditRs')}><input className="wp-input tabular" type="number" min="0" value={form.creditLimit} readOnly={!setsMoney} onChange={(e) => set('creditLimit', e.target.value)} /></Field>
                </div>
                {can('team.view') && (
                    <Field label={`${t('salesRepLabel')} (${t('optionalWord')})`}>
                        <select className="wp-input" value={form.assignedRepId} onChange={(e) => set('assignedRepId', e.target.value)}>
                            <option value="">{t('noRepAssigned')}</option>
                            {(reps || []).map((r: any) => <option key={r._id} value={r._id}>{r.name}</option>)}
                        </select>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('repAssignHint')}</p>
                    </Field>
                )}
                {formErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{formErr}</p>}
            </Modal>

            {/* Collect payment */}
            <Modal open={!!collectFor} onClose={() => setCollectFor(null)} title={t('collectPayment')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={collect.isPending || !Number(amount)} onClick={() => collect.mutate()}><Check size={16} /> {t('confirm')}</button>}>
                {collectFor && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{collectFor.name} owes <b>{inr2(collectFor.outstandingBalance)}</b></p>}
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('amountReceived')}><input className="wp-input tabular" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
                    <Field label={t('paymentMode')}><select className="wp-input capitalize" value={payMode} onChange={(e) => setPayMode(e.target.value)}>{['cash', 'upi', 'bank', 'cheque', 'other'].map((m) => <option key={m} value={m}>{t('mode_' + m)}</option>)}</select></Field>
                </div>

                {/* How the dealer can pay */}
                {(biz?.upiId || biz?.upiQrImage || biz?.bank?.account) && (
                    <div className="rounded-xl p-3 mb-3 mt-1" style={{ background: 'var(--surface-2)' }}>
                        {(biz?.upiId || biz?.upiQrImage) && (
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-sm min-w-0 truncate"><span style={{ color: 'var(--text-muted)' }}>{t('payTo')}: </span><b style={{ color: 'var(--text-primary)' }}>{biz.upiId || 'UPI'}</b></span>
                                <button type="button" className="wp-btn wp-btn-ghost !py-1.5 shrink-0" onClick={() => setShowQr(true)}><QrCode size={15} /> {t('showQr')}</button>
                            </div>
                        )}
                        {biz?.bank?.account && (
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('bankName')}: {biz.bank.name || '—'} · A/c {biz.bank.account}{biz.bank.ifsc ? ` · IFSC ${biz.bank.ifsc}` : ''}</p>
                        )}
                    </div>
                )}
                {collectFor && collectFor.mobile && (
                    <button type="button" className="wp-btn wp-btn-ghost w-full mb-1" onClick={() => remindDealer(collectFor)}><MessageCircle size={15} style={{ color: 'var(--success)' }} /> {t('sendReminderWa')}</button>
                )}
                {collectErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{collectErr}</p>}
            </Modal>

            {showQr && collectFor && <UpiQr amount={Number(amount) || collectFor.outstandingBalance} upiId={biz?.upiId} qrImage={biz?.upiQrImage} shopName={biz?.name} onClose={() => setShowQr(false)} />}

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('removeDealerTitle')} message={`Remove “${del?.name}” from your dealers?`} />
        </div>
    );
}
