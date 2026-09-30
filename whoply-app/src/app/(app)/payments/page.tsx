'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Wallet, ShoppingBag, Building2 } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api, apiErr, fetchAll } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { useT } from '@/i18n';
import { paymentsToCsv, downloadFile } from '@/lib/bill';

const MODES = ['all', 'cash', 'upi', 'bank', 'cheque', 'other'] as const;
const modeTone: Record<string, any> = {
    cash: { background: 'var(--success-tint)', color: 'var(--success)' },
    upi: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    bank: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    cheque: { background: 'var(--warning-tint)', color: 'var(--warning)' },
    other: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function PaymentsPage() {
    const t = useT();
    const [mode, setMode] = useState<string>('all');

    const [page, setPage] = useState(1);
    const modeQ = mode === 'all' ? '' : `&mode=${mode}`;
    // The server filters, pages and totals — the list used to stop at the newest 100.
    const { data } = useQuery({ queryKey: ['payments', mode, page], queryFn: async () => (await api.get(`/wholesaler/payments?limit=50&page=${page}${modeQ}`)).data.data, placeholderData: (p) => p });
    const rows = data?.items || [];
    const total = data?.sum || 0;
    const meta = data?.meta;
    const exportAll = async () => {
        try { downloadFile(`whoply-payments-${mode}.csv`, paymentsToCsv(await fetchAll(`/wholesaler/payments?x=1${modeQ}`))); }
        catch (e) { alert(apiErr(e)); }
    };
    const modeLabel = (m: string) => (m === 'all' ? t('all') : t('mode_' + m));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('paymentsTitle')}</h1>
                <button className="wp-btn wp-btn-ghost" onClick={exportAll} disabled={!rows.length}><Download size={16} /> {t('exportCsv')}</button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><Wallet size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalCollectedLabel')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(total)}</p></div>
                </div>
                <div className="wp-card p-5 flex items-center gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><RupeeIcon size={20} /></div>
                    <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('paymentsCountLabel')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{meta?.total ?? rows.length}</p></div>
                </div>
            </div>

            {/* Mode filter */}
            <div className="flex gap-1 p-1 rounded-xl w-fit overflow-x-auto wp-scroll" style={{ background: 'var(--surface-2)' }}>
                {MODES.map((m) => (
                    <button key={m} onClick={() => { setMode(m); setPage(1); }} className="px-3.5 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap transition-all"
                        style={mode === m ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {modeLabel(m)}
                    </button>
                ))}
            </div>

            {/* Ledger */}
            {rows.length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noPayments')}</p>}
            <div className="space-y-2">
                {rows.map((p: any) => (
                    <div key={p._id} className="wp-card p-3.5 flex items-center gap-3">
                        <div className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--brand-text)' }}>
                            {p.orderNo ? <ShoppingBag size={16} /> : <Building2 size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.dealerName || t('dealer')}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {p.orderNo || t('onAccount')} · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{p.note ? ` · ${p.note}` : ''}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold tabular" style={{ color: p.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>{inr2(p.amount)}</p>
                            <span className="wp-chip capitalize mt-0.5" style={modeTone[p.mode] || modeTone.other}>{t('mode_' + p.mode)}</span>
                        </div>
                    </div>
                ))}
            </div>
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>‹</button>
                    <span className="tabular">{meta.page} / {meta.totalPages}</span>
                    <button className="wp-btn wp-btn-ghost !py-1.5" disabled={page >= meta.totalPages} onClick={() => setPage((x) => x + 1)}>›</button>
                </div>
            )}
        </div>
    );
}
