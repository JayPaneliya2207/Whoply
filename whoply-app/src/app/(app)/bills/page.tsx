'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Download, MessageCircle, Printer, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal } from '@/components/Modal';
import { useT } from '@/i18n';
import { buildBillText, whatsappLink, printBill, billsToCsv, downloadFile } from '@/lib/bill';

const statusTone: Record<string, any> = {
    paid: { background: '#dcfce7', color: 'var(--success-600)' },
    partial: { background: '#fef3c7', color: 'var(--accent-600)' },
    credit: { background: '#fef3c7', color: 'var(--accent-600)' },
};
const FILTERS = ['all', 'paid', 'credit'] as const;

export default function BillsPage() {
    const qc = useQueryClient();
    const t = useT();
    const [status, setStatus] = useState<string>('all');
    const [detailId, setDetailId] = useState<string | null>(null);

    const shareOnWhatsapp = (inv: any) => {
        if (!inv.customerMobile) { alert('No customer mobile on this bill.'); return; }
        window.open(whatsappLink(inv.customerMobile, buildBillText(inv, inv.business), inv.business?.countryCode || '+91'), '_blank');
        api.post(`/shopkeeper/billing/${inv._id}/mark-sent`).then(() => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['bill'] }); }).catch(() => {});
    };

    const { data, isLoading } = useQuery({
        queryKey: ['bills', status],
        queryFn: async () => (await api.get(`/shopkeeper/billing?limit=100${status !== 'all' ? `&status=${status}` : ''}`)).data.data.items,
        refetchOnMount: 'always',
    });
    const { data: detail } = useQuery({ queryKey: ['bill', detailId], queryFn: async () => (await api.get(`/shopkeeper/billing/${detailId}`)).data.data, enabled: !!detailId });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('bills')}</h1>
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile(`whoply-bills-${status}.csv`, billsToCsv(data || []))} disabled={!(data || []).length}><Download size={16} /> CSV</button>
                    <Link href="/billing" className="wp-btn wp-btn-primary"><Plus size={16} /> {t('newBill')}</Link>
                </div>
            </div>

            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatus(f)} className="px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                        style={status === f ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {f === 'all' ? t('all') : f === 'paid' ? t('paid') : f}
                    </button>
                ))}
            </div>

            {/* Box grid — scrolls up/down only */}
            {isLoading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>}
            {!isLoading && (data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noBillsYet')}</p>}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((inv: any) => (
                    <button key={inv._id} onClick={() => setDetailId(inv._id)} className="wp-card wp-card-hover p-4 text-left">
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</p>
                            <span className="wp-chip shrink-0" style={statusTone[inv.status]}>{inv.status}</span>
                        </div>
                        <p className="text-xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</p>
                        <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{inv.customerName || t('walkIn')} · <span className="capitalize">{inv.paymentMode}</span></p>
                            <p className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        {inv.whatsappSentAt && <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--success-600)' }}><CheckCheck size={12} /> {t('sentOnWhatsapp')}</p>}
                    </button>
                ))}
            </div>

            {/* Bill detail */}
            <Modal open={!!detailId} onClose={() => setDetailId(null)} title={detail?.invoiceNo || 'Bill'}
                footer={detail && (
                    <div className="flex gap-2">
                        <button className="wp-btn wp-btn-ghost flex-1" onClick={() => shareOnWhatsapp(detail)}>
                            <MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp{detail.whatsappSentAt ? ' again' : ''}
                        </button>
                        <button className="wp-btn wp-btn-primary flex-1" onClick={() => printBill(detail, detail.business)}><Printer size={16} /> {t('printPdf')}</button>
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.customerName || t('walkIn')}</span>
                            <span className="wp-chip capitalize" style={statusTone[detail.status]}>{detail.paymentMode} · {detail.status}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(detail.createdAt).toLocaleString('en-IN')}</p>
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                            {detail.items.map((it: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{it.name} <span style={{ color: 'var(--text-muted)' }}>× {it.quantity}</span></span>
                                    <span className="tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(it.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>{t('subtotal')}</span><span className="tabular">{inr2(detail.subtotal)}</span></div>
                            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>{t('gst')}</span><span className="tabular">{inr2(detail.totalGst)}</span></div>
                            {detail.discount > 0 && <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Discount</span><span className="tabular">- {inr2(detail.discount)}</span></div>}
                            <div className="flex justify-between text-lg font-extrabold pt-1" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--card-border)' }}><span>{t('total')}</span><span className="tabular">{inr2(detail.grandTotal)}</span></div>
                            {detail.dueAmount > 0 && <div className="flex justify-between font-semibold" style={{ color: 'var(--accent-600)' }}><span>{t('due')} (udhar)</span><span className="tabular">{inr2(detail.dueAmount)}</span></div>}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
