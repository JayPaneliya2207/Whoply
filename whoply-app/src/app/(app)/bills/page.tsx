'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Download, MessageCircle, Printer, CheckCheck, FileJson, Truck, RotateCcw } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal } from '@/components/Modal';
import { useT } from '@/i18n';
import { buildBillText, whatsappLink, printBill, printCreditNote, printEInvoice, printEwayBill, billsToCsv, downloadFile, type PrintFormat } from '@/lib/bill';

const PRINT_FORMATS: { k: PrintFormat; label: string }[] = [
    { k: 'a4', label: 'A4' },
    { k: '80mm', label: '80mm' },
    { k: '58mm', label: '58mm' },
];

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
    const [printFmt, setPrintFmt] = useState<PrintFormat>('a4');
    const [ewayOpen, setEwayOpen] = useState(false);
    const [eway, setEway] = useState({ vehicleNo: '', distance: '', transMode: '1', transporterName: '' });
    const [returning, setReturning] = useState(false);
    const [retQty, setRetQty] = useState<Record<string, string>>({});
    const [retReason, setRetReason] = useState('');
    const [retMode, setRetMode] = useState<'cash' | 'udhar_adjust'>('cash');
    const [retErr, setRetErr] = useState('');

    const openReturn = () => { setRetQty({}); setRetReason(''); setRetMode('cash'); setRetErr(''); setReturning(true); setEwayOpen(false); };
    const submitReturn = async (inv: any) => {
        const items = Object.entries(retQty).map(([productId, q]) => ({ productId, quantity: Number(q) || 0 })).filter((x) => x.quantity > 0);
        if (!items.length) { setRetErr(t('selectReturnQty')); return; }
        try {
            const { data } = await api.post('/shopkeeper/returns', { invoiceId: inv._id, items, reason: retReason || undefined, refundMode: retMode });
            setReturning(false);
            qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['customers'] }); qc.invalidateQueries({ queryKey: ['returns'] });
            if (confirm(t('returnRecordedPrint'))) printCreditNote(data.data.creditNote, inv.business);
        } catch (e) { setRetErr(apiErr(e)); }
    };

    const genEInvoice = async (inv: any) => {
        try { const { data } = await api.get(`/shopkeeper/billing/${inv._id}/einvoice`); printEInvoice(data.data, inv.business); }
        catch (e) { alert(apiErr(e)); }
    };
    const genEway = async (inv: any) => {
        try { const { data } = await api.post(`/shopkeeper/billing/${inv._id}/eway`, { ...eway, distance: Number(eway.distance) || 0 }); printEwayBill(data.data, inv.business); setEwayOpen(false); }
        catch (e) { alert(apiErr(e)); }
    };

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
            <Modal open={!!detailId} onClose={() => { setDetailId(null); setEwayOpen(false); setReturning(false); }} title={detail?.invoiceNo || 'Bill'}
                footer={detail && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{t('printSize')}</span>
                            <div className="flex gap-1 p-1 rounded-lg flex-1" style={{ background: 'var(--surface-2)' }}>
                                {PRINT_FORMATS.map((f) => (
                                    <button key={f.k} onClick={() => setPrintFmt(f.k)} className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                                        style={printFmt === f.k ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>{f.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="wp-btn wp-btn-ghost flex-1" onClick={() => shareOnWhatsapp(detail)}>
                                <MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp{detail.whatsappSentAt ? ' again' : ''}
                            </button>
                            <button className="wp-btn wp-btn-primary flex-1" onClick={() => printBill(detail, detail.business, printFmt)}><Printer size={16} /> {printFmt === 'a4' ? t('printPdf') : t('printReceipt')}</button>
                        </div>
                        {/* e-Invoice / e-Way are GST-compliance tools: only relevant for a B2B bill
                            (customer has a GSTIN) or a high-value consignment (≥ ₹50,000). Hidden otherwise
                            so an ordinary retail counter sale stays uncluttered. */}
                        {(() => {
                            const gstDoc = !!detail.customerGstin || (detail.grandTotal || 0) >= 50000;
                            return (
                                <div className={`grid gap-2 ${gstDoc ? 'grid-cols-3' : 'grid-cols-1'}`}>
                                    {gstDoc && <button className="wp-btn wp-btn-ghost !py-2 !px-2 text-sm min-w-0" onClick={() => genEInvoice(detail)}><FileJson size={15} className="shrink-0" /> <span className="truncate">{t('eInvoiceJson')}</span></button>}
                                    {gstDoc && <button className="wp-btn wp-btn-ghost !py-2 !px-2 text-sm min-w-0" onClick={() => setEwayOpen((v) => !v)}><Truck size={15} className="shrink-0" /> <span className="truncate">{t('ewayBill')}</span></button>}
                                    <button className="wp-btn wp-btn-ghost !py-2 !px-2 text-sm min-w-0" onClick={openReturn}><RotateCcw size={15} className="shrink-0" /> <span className="truncate">{t('returnItems')}</span></button>
                                </div>
                            );
                        })()}
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.customerName || t('walkIn')}</span>
                            <span className="wp-chip capitalize" style={statusTone[detail.status]}>{detail.paymentMode} · {detail.status}</span>
                        </div>
                        {ewayOpen && (
                            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><Truck size={15} /> {t('ewayBill')}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="wp-input text-sm uppercase" placeholder={t('vehicleNoPh')} value={eway.vehicleNo} onChange={(e) => setEway({ ...eway, vehicleNo: e.target.value.toUpperCase() })} />
                                    <input className="wp-input text-sm tabular" type="number" placeholder={t('distanceKm')} value={eway.distance} onChange={(e) => setEway({ ...eway, distance: e.target.value })} />
                                    <select className="wp-input text-sm" value={eway.transMode} onChange={(e) => setEway({ ...eway, transMode: e.target.value })}>
                                        <option value="1">{t('modeRoad')}</option><option value="2">{t('modeRail')}</option><option value="3">{t('modeAir')}</option><option value="4">{t('modeShip')}</option>
                                    </select>
                                    <input className="wp-input text-sm" placeholder={t('transporterName')} value={eway.transporterName} onChange={(e) => setEway({ ...eway, transporterName: e.target.value })} />
                                </div>
                                <button className="wp-btn wp-btn-primary w-full !py-2 text-sm" onClick={() => genEway(detail)}><Download size={15} /> {t('generateEwayJson')}</button>
                            </div>
                        )}
                        {/* Return / credit note */}
                        {returning && (
                            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><RotateCcw size={15} /> {t('returnItems')}</p>
                                <div className="space-y-1.5">
                                    {detail.items.map((it: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{it.name} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({t('sold')} {it.quantity})</span></span>
                                            <input className="wp-input !py-1.5 w-16 text-sm tabular text-right" type="number" min={0} max={it.quantity} placeholder="0"
                                                value={retQty[it.productId] || ''} onChange={(e) => { const v = Math.min(it.quantity, Math.max(0, Number(e.target.value) || 0)); setRetQty((q) => ({ ...q, [it.productId]: v ? String(v) : '' })); }} />
                                        </div>
                                    ))}
                                </div>
                                <input className="wp-input text-sm" placeholder={t('returnReasonPh')} value={retReason} onChange={(e) => setRetReason(e.target.value)} />
                                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card-bg)' }}>
                                    {([['cash', t('cashRefund')], ['udhar_adjust', t('adjustUdhar')]] as const).map(([k, label]) => (
                                        <button key={k} onClick={() => setRetMode(k)} className="flex-1 py-1.5 rounded-md text-xs font-semibold" style={retMode === k ? { background: 'var(--surface-2)', color: 'var(--brand-700)' } : { color: 'var(--text-secondary)' }}>{label}</button>
                                    ))}
                                </div>
                                {retErr && <p className="text-xs" style={{ color: 'var(--danger-500)' }}>{retErr}</p>}
                                <div className="flex gap-2">
                                    <button className="wp-btn wp-btn-ghost flex-1 !py-2 text-sm" onClick={() => setReturning(false)}>{t('cancel')}</button>
                                    <button className="wp-btn wp-btn-primary flex-1 !py-2 text-sm" onClick={() => submitReturn(detail)}><RotateCcw size={15} /> {t('recordReturn')}</button>
                                </div>
                            </div>
                        )}
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
