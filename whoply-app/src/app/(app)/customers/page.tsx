'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, MessageCircle, IndianRupee, X, Check } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { buildUdharReminderText, whatsappLink } from '@/lib/bill';

export default function CustomersPage() {
    const { user } = useAuth();
    const t = useT();
    const qc = useQueryClient();
    const [dueOnly, setDueOnly] = useState(false);
    const [payFor, setPayFor] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');

    const { data } = useQuery({
        queryKey: ['customers-page', dueOnly],
        queryFn: async () => (await api.get(`/shopkeeper/customers?limit=100${dueOnly ? '&hasDue=true' : ''}`)).data.data.items,
    });

    const repay = useMutation({
        mutationFn: async () => (await api.post(`/shopkeeper/customers/${payFor._id}/repayment`, { amount: Number(amount) })).data.data,
        onSuccess: () => {
            setPayFor(null); setAmount(''); setError('');
            qc.invalidateQueries({ queryKey: ['customers-page'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (e) => setError(apiErr(e)),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {user?.business?.type === 'wholesale' ? t('dealers') : t('customersUdhar')}
                </h1>
                <button onClick={() => setDueOnly((v) => !v)} className="wp-btn wp-btn-ghost text-sm"
                    style={dueOnly ? { background: '#fef3c7', color: 'var(--accent-600)', borderColor: 'transparent' } : {}}>
                    <Wallet size={15} /> {t('withDuesOnly')}
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((c: any) => (
                    <motion.div key={c._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="wp-card wp-card-hover p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 grid place-items-center rounded-full font-bold" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{c.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.mobile || t('noMobile')} · {c.loyaltyPoints} {t('pts')}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('udharBalance')}</p>
                                <p className="text-lg font-extrabold tabular" style={{ color: c.creditBalance > 0 ? 'var(--accent-600)' : 'var(--success-600)' }}>{inr2(c.creditBalance)}</p>
                            </div>
                            {c.creditBalance > 0 && (
                                <div className="flex gap-1.5">
                                    <button className="wp-btn wp-btn-ghost !px-2.5 !py-2" title="Send WhatsApp udhar reminder"
                                        onClick={() => {
                                            if (!c.mobile) { alert(`No mobile number on file for ${c.name}. Add one to send a reminder.`); return; }
                                            window.open(whatsappLink(c.mobile, buildUdharReminderText(c.name, c.creditBalance, user?.business ? { name: user.business.name } : undefined), c.countryCode || '+91'), '_blank');
                                        }}>
                                        <MessageCircle size={15} style={{ color: 'var(--success-600)' }} />
                                    </button>
                                    <button className="wp-btn wp-btn-accent !px-2.5 !py-2" onClick={() => { setPayFor(c); setAmount(String(c.creditBalance)); }}>
                                        <IndianRupee size={15} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Repayment modal */}
            {payFor && (
                <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setPayFor(null)}>
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('recordRepayment')}</h3>
                            <button onClick={() => setPayFor(null)}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                        </div>
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{payFor.name} owes <b>{inr2(payFor.creditBalance)}</b></p>
                        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('amountReceived')}</label>
                        <input className="wp-input mt-1.5 mb-3 tabular" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
                        {error && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                        <button className="wp-btn wp-btn-primary w-full" disabled={repay.isPending || !Number(amount)} onClick={() => repay.mutate()}>
                            <Check size={16} /> {t('confirmRepayment')}
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
