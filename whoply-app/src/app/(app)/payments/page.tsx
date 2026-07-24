'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, IndianRupee, Wallet, ShoppingBag, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { useT } from '@/i18n';
import { paymentsToCsv, downloadFile } from '@/lib/bill';

const MODES = ['all', 'cash', 'upi', 'bank', 'cheque', 'other'] as const;
const modeTone: Record<string, any> = {
    cash: { background: '#dcfce7', color: 'var(--success-600)' },
    upi: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    bank: { background: '#e0e7ff', color: 'var(--brand-700)' },
    cheque: { background: '#fef3c7', color: 'var(--accent-600)' },
    other: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function PaymentsPage() {
    const t = useT();
    const [mode, setMode] = useState<string>('all');

    const { data: payments } = useQuery({ queryKey: ['payments'], queryFn: async () => (await api.get('/wholesaler/payments?limit=200')).data.data.items });
    const rows = useMemo(() => (mode === 'all' ? (payments || []) : (payments || []).filter((p: any) => p.mode === mode)), [payments, mode]);
    const total = useMemo(() => rows.reduce((s: number, p: any) => s + (p.amount || 0), 0), [rows]);
    const modeLabel = (m: string) => (m === 'all' ? t('all') : t('mode_' + m));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('paymentsTitle')}</h1>
                <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile(`whoply-payments-${mode}.csv`, paymentsToCsv(rows))} disabled={!rows.length}><Download size={16} /> {t('exportCsv')}</button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: '#dcfce7', color: 'var(--success-600)' }}><Wallet size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalCollectedLabel')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(total)}</p></div>
                </div>
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><IndianRupee size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('paymentsCountLabel')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{rows.length}</p></div>
                </div>
            </div>

            {/* Mode filter */}
            <div className="flex gap-1 p-1 rounded-xl w-fit overflow-x-auto wp-scroll" style={{ background: 'var(--surface-2)' }}>
                {MODES.map((m) => (
                    <button key={m} onClick={() => setMode(m)} className="px-3.5 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap transition-all"
                        style={mode === m ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {modeLabel(m)}
                    </button>
                ))}
            </div>

            {/* Ledger */}
            {rows.length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noPayments')}</p>}
            <div className="space-y-2">
                {rows.map((p: any) => (
                    <div key={p._id} className="wp-card p-3.5 flex items-center gap-3">
                        <div className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--brand-700)' }}>
                            {p.orderNo ? <ShoppingBag size={16} /> : <Building2 size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.dealerName || t('dealer')}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {p.orderNo || t('onAccount')} · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{p.note ? ` · ${p.note}` : ''}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold tabular" style={{ color: 'var(--success-600)' }}>{inr2(p.amount)}</p>
                            <span className="wp-chip capitalize mt-0.5" style={modeTone[p.mode] || modeTone.other}>{t('mode_' + p.mode)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
