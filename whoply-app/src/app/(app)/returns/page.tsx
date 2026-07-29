'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Printer, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { Modal } from '@/components/Modal';
import { printCreditNote, downloadFile } from '@/lib/bill';

const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function ReturnsPage() {
    const t = useT();
    const { user } = useAuth();
    const isWholesale = user?.business?.type === 'wholesale';
    const biz = user?.business ? { name: user.business.name, gstin: user.business.gstin } : undefined;
    const [detail, setDetail] = useState<any>(null);

    const { data: notes } = useQuery({ queryKey: isWholesale ? ['ws-returns'] : ['returns'], queryFn: async () => (await api.get(`/${isWholesale ? 'wholesaler' : 'shopkeeper'}/returns?limit=100`)).data.data.items });
    const against = (n: any) => n.orderNo || n.invoiceNo || '';
    const total = (notes || []).reduce((s: number, n: any) => s + (n.total || 0), 0);

    const exportCsv = () => {
        const header = ['Credit Note', 'Date', 'Against Bill', 'Customer', 'Items', 'Refund Total', 'Mode', 'Reason'];
        const rows = (notes || []).map((n: any) => [n.creditNoteNo, new Date(n.createdAt).toLocaleString('en-IN'), against(n), n.customerName || '', n.items?.length || 0, n.total, n.refundMode, n.reason || ''].map(esc).join(','));
        downloadFile('whoply-returns.csv', [header.map(esc).join(','), ...rows].join('\n'));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('returnsCreditNotes')}</h1>
                <button className="wp-btn wp-btn-ghost" onClick={exportCsv} disabled={!(notes || []).length}><Download size={16} /> {t('exportCsv')}</button>
            </div>

            <div className="wp-card p-5 flex items-center gap-3">
                <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: '#fee2e2', color: 'var(--danger-500)' }}><RotateCcw size={20} /></div>
                <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalRefunded')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(total)}</p></div>
                <div className="ml-auto text-right"><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('creditNotes')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{(notes || []).length}</p></div>
            </div>

            {(notes || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noReturns')}</p>}
            <div className="space-y-2">
                {(notes || []).map((n: any) => (
                    <button key={n._id} onClick={() => setDetail(n)} className="wp-card wp-card-hover p-3.5 w-full flex items-center gap-3 text-left">
                        <div className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--danger-500)' }}><RotateCcw size={16} /></div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{n.creditNoteNo}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.customerName || t('walkIn')} · {t('againstBill')} {against(n)} · {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold tabular" style={{ color: 'var(--danger-500)' }}>−{inr2(n.total)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{n.refundMode === 'udhar_adjust' ? t('adjustUdhar') : t('cashRefund')}</p>
                        </div>
                    </button>
                ))}
            </div>

            <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.creditNoteNo || 'Credit note'}
                footer={detail && <button className="wp-btn wp-btn-primary w-full" onClick={() => printCreditNote(detail, biz)}><Printer size={16} /> {t('printPdf')}</button>}>
                {detail && (
                    <div className="space-y-3">
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{detail.customerName || t('walkIn')} · {t('againstBill')} {against(detail)}</p>
                        {detail.reason && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{detail.reason}</p>}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                            {detail.items.map((it: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{it.name} <span style={{ color: 'var(--text-muted)' }}>× {it.quantity}</span></span>
                                    <span className="tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(it.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-lg font-extrabold" style={{ color: 'var(--danger-500)' }}><span>{t('refundTotal')}</span><span className="tabular">{inr2(detail.total)}</span></div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
