'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Download, MessageCircle, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal } from '@/components/Modal';
import { buildBillText, whatsappLink, printBill, billsToCsv, downloadFile } from '@/lib/bill';

const statusTone: Record<string, any> = {
    paid: { background: '#dcfce7', color: 'var(--success-600)' },
    partial: { background: '#fef3c7', color: 'var(--accent-600)' },
    credit: { background: '#fef3c7', color: 'var(--accent-600)' },
};
const FILTERS = ['all', 'paid', 'credit'] as const;

export default function BillsPage() {
    const [status, setStatus] = useState<string>('all');
    const [detailId, setDetailId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['bills', status],
        queryFn: async () => (await api.get(`/shopkeeper/billing?limit=100${status !== 'all' ? `&status=${status}` : ''}`)).data.data.items,
        refetchOnMount: 'always',
    });
    const { data: detail } = useQuery({ queryKey: ['bill', detailId], queryFn: async () => (await api.get(`/shopkeeper/billing/${detailId}`)).data.data, enabled: !!detailId });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Bills</h1>
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile(`whoply-bills-${status}.csv`, billsToCsv(data || []))} disabled={!(data || []).length}><Download size={16} /> CSV</button>
                    <Link href="/billing" className="wp-btn wp-btn-primary"><Plus size={16} /> New Bill</Link>
                </div>
            </div>

            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatus(f)} className="px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                        style={status === f ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {f === 'all' ? 'All' : f}
                    </button>
                ))}
            </div>

            {/* Box grid — scrolls up/down only */}
            {isLoading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!isLoading && (data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>No bills yet.</p>}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((inv: any) => (
                    <button key={inv._id} onClick={() => setDetailId(inv._id)} className="wp-card wp-card-hover p-4 text-left">
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNo}</p>
                            <span className="wp-chip shrink-0" style={statusTone[inv.status]}>{inv.status}</span>
                        </div>
                        <p className="text-xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(inv.grandTotal)}</p>
                        <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{inv.customerName || 'Walk-in'} · <span className="capitalize">{inv.paymentMode}</span></p>
                            <p className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Bill detail */}
            <Modal open={!!detailId} onClose={() => setDetailId(null)} title={detail?.invoiceNo || 'Bill'}
                footer={detail && (
                    <div className="flex gap-2">
                        <button className="wp-btn wp-btn-ghost flex-1" onClick={() => { if (!detail.customerMobile) { alert('No customer mobile on this bill.'); return; } window.open(whatsappLink(detail.customerMobile, buildBillText(detail, detail.business), detail.business?.countryCode || '+91'), '_blank'); }}>
                            <MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp
                        </button>
                        <button className="wp-btn wp-btn-primary flex-1" onClick={() => printBill(detail, detail.business)}><Printer size={16} /> Print / PDF</button>
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.customerName || 'Walk-in'}</span>
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
                            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Subtotal</span><span className="tabular">{inr2(detail.subtotal)}</span></div>
                            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>GST</span><span className="tabular">{inr2(detail.totalGst)}</span></div>
                            {detail.discount > 0 && <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Discount</span><span className="tabular">- {inr2(detail.discount)}</span></div>}
                            <div className="flex justify-between text-lg font-extrabold pt-1" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--card-border)' }}><span>Total</span><span className="tabular">{inr2(detail.grandTotal)}</span></div>
                            {detail.dueAmount > 0 && <div className="flex justify-between font-semibold" style={{ color: 'var(--accent-600)' }}><span>Due (udhar)</span><span className="tabular">{inr2(detail.dueAmount)}</span></div>}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
