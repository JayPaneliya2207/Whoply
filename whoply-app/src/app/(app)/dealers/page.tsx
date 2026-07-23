'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, IndianRupee, Check, MessageCircle, Plus, Pencil, Trash2, QrCode } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { useT } from '@/i18n';
import { UpiQr } from '@/components/UpiQr';
import { buildDealerPaymentText, whatsappLink } from '@/lib/bill';

const tierTone: Record<string, any> = {
    A: { background: '#dcfce7', color: 'var(--success-600)' },
    B: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    C: { background: '#fef3c7', color: 'var(--accent-600)' },
};
// "tier" renamed to a friendly Price Group for clarity
const groupKey: Record<string, string> = { A: 'tierPremium', B: 'tierStandard', C: 'tierBasic' };
const empty = { name: '', shopName: '', mobile: '', country: '+91', tier: 'B', city: '', creditLimit: '100000' };

export default function DealersPage() {
    const qc = useQueryClient();
    const t = useT();
    const [showQr, setShowQr] = useState(false);
    const { data: biz } = useQuery({ queryKey: ['ws-business'], queryFn: async () => (await api.get('/wholesaler/business')).data.data });
    // Remind a dealer on WhatsApp — includes how to pay (UPI + bank details).
    const remindDealer = (d: any) => {
        if (!d.mobile) { alert('Add a mobile number for this dealer to send a reminder.'); return; }
        window.open(whatsappLink(d.mobile, buildDealerPaymentText(d.name, d.outstandingBalance, biz), d.countryCode || '+91'), '_blank');
    };
    const [collectFor, setCollectFor] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [collectErr, setCollectErr] = useState('');

    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [formErr, setFormErr] = useState('');
    const [del, setDel] = useState<any>(null);

    const { data } = useQuery({ queryKey: ['dealers'], queryFn: async () => (await api.get('/wholesaler/dealers?limit=100')).data.data.items });

    const openNew = () => { setEditing(null); setForm(empty); setFormErr(''); setModal(true); };
    const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, shopName: d.shopName || '', mobile: d.mobile || '', country: d.countryCode || '+91', tier: d.tier, city: d.city || '', creditLimit: d.creditLimit }); setFormErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            const { country, ...rest } = form;
            const body = { ...rest, countryCode: country, creditLimit: Number(form.creditLimit) || 0 };
            if (editing) return (await api.patch(`/wholesaler/dealers/${editing._id}`, body)).data.data;
            return (await api.post('/wholesaler/dealers', body)).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['dealers'] }); },
        onError: (e) => setFormErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/wholesaler/dealers/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['dealers'] }); },
    });
    const collect = useMutation({
        mutationFn: async () => (await api.post(`/wholesaler/dealers/${collectFor._id}/collect`, { amount: Number(amount) })).data.data,
        onSuccess: () => { setCollectFor(null); setAmount(''); setCollectErr(''); qc.invalidateQueries({ queryKey: ['dealers'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
        onError: (e) => setCollectErr(apiErr(e)),
    });

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('dealersTitle')}</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> {t('addDealer')}</button>
            </div>

            {(data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noDealersYet')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((d: any) => (
                    <motion.div key={d._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="wp-card wp-card-hover p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><Building2 size={18} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.city || '—'} · {d.mobile}</p>
                            </div>
                            <span className="wp-chip" style={tierTone[d.tier]}>{t(groupKey[d.tier])}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('outstandingWord')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: d.outstandingBalance > 0 ? 'var(--accent-600)' : 'var(--success-600)' }}>{inr2(d.outstandingBalance)}</p>
                            </div>
                            <div className="flex gap-1.5">
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(d)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(d)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                                {d.outstandingBalance > 0 && (
                                    <>
                                        <button className="wp-btn wp-btn-ghost !p-2" title="Send WhatsApp payment reminder" onClick={() => remindDealer(d)}><MessageCircle size={14} style={{ color: 'var(--success-600)' }} /></button>
                                        <button className="wp-btn wp-btn-accent !p-2" onClick={() => { setCollectFor(d); setAmount(String(d.outstandingBalance)); }}><IndianRupee size={14} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Add/Edit dealer */}
            <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('editDealer') : t('addDealer')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>{editing ? t('save') : t('addDealer')}</button>}>
                <Field label={t('dealerNameLabel')}><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ravi Traders" autoFocus /></Field>
                <Field label={t('shopNameLabel')}><input className="wp-input" value={form.shopName} onChange={(e) => set('shopName', e.target.value)} placeholder="e.g. Ravi Kirana Store" /></Field>
                <Field label={t('mobile')}><PhoneInput value={form.mobile} onChange={(v) => set('mobile', v)} country={form.country} onCountryChange={(c) => set('country', c)} /></Field>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={t('priceGroup')}><select className="wp-input" value={form.tier} onChange={(e) => set('tier', e.target.value)}><option value="A">{t('premiumBest')}</option><option value="B">{t('tierStandard')}</option><option value="C">{t('tierBasic')}</option></select></Field>
                    <Field label={t('cityLabel')}><input className="wp-input" value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
                    <Field label={t('creditRs')}><input className="wp-input tabular" type="number" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} /></Field>
                </div>
                {formErr && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{formErr}</p>}
            </Modal>

            {/* Collect payment */}
            <Modal open={!!collectFor} onClose={() => setCollectFor(null)} title={t('collectPayment')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={collect.isPending || !Number(amount)} onClick={() => collect.mutate()}><Check size={16} /> {t('confirm')}</button>}>
                {collectFor && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{collectFor.name} owes <b>{inr2(collectFor.outstandingBalance)}</b></p>}
                <Field label={t('amountReceived')}><input className="wp-input tabular" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>

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
                    <button type="button" className="wp-btn wp-btn-ghost w-full mb-1" onClick={() => remindDealer(collectFor)}><MessageCircle size={15} style={{ color: 'var(--success-600)' }} /> {t('sendReminderWa')}</button>
                )}
                {collectErr && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{collectErr}</p>}
            </Modal>

            {showQr && collectFor && <UpiQr amount={Number(amount) || collectFor.outstandingBalance} upiId={biz?.upiId} qrImage={biz?.upiQrImage} shopName={biz?.name} onClose={() => setShowQr(false)} />}

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('removeDealerTitle')} message={`Remove “${del?.name}” from your dealers?`} />
        </div>
    );
}
