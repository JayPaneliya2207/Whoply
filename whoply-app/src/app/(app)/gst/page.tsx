'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Percent, Building2, Users, Truck, Scale } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api } from '@/lib/api';
import { inr } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { downloadFile, csvCell } from '@/lib/bill';

const esc = csvCell;
const toCsv = (header: string[], rows: any[][]) => [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');

export default function GstPage() {
    const t = useT();
    const { user } = useAuth();
    const base = user?.business?.type === 'wholesale' ? 'wholesaler' : 'shopkeeper';
    const now = new Date();
    const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const { data } = useQuery({ queryKey: ['gst', base, month], queryFn: async () => (await api.get(`/${base}/reports/gst?month=${month}`)).data.data });

    const sum = data?.summary;
    const rate = (r: number) => `${r}%`;

    const exportGstr3b = () => {
        if (!data) return;
        const rows = [
            ['Taxable value', sum.taxableValue],
            ['CGST', sum.cgst], ['SGST', sum.sgst], ['IGST', sum.igst],
            ['Total tax', sum.totalTax],
            ['Discount', sum.discount],
            ['Invoice value', sum.invoiceValue],
            ['Invoices', sum.invoices],
            ['Input tax credit — CGST', data.itc?.cgst ?? 0], ['Input tax credit — SGST', data.itc?.sgst ?? 0], ['Input tax credit — IGST', data.itc?.igst ?? 0],
            ['GST to pay (estimate) — CGST', data.gstToPay?.payable?.cgst ?? 0], ['GST to pay (estimate) — SGST', data.gstToPay?.payable?.sgst ?? 0], ['GST to pay (estimate) — IGST', data.gstToPay?.payable?.igst ?? 0],
            ['Credit carried forward', data.gstToPay?.carryForward?.total ?? 0],
        ];
        downloadFile(`gstr3b-${month}.csv`, toCsv(['GSTR-3B Summary', 'Amount'], rows));
    };
    const exportRateWise = () => {
        if (!data) return;
        const rows = data.rateWise.map((r: any) => [rate(r.rate), r.taxable, r.cgst, r.sgst, r.igst ?? 0, r.gst]);
        downloadFile(`gstr1-b2c-ratewise-${month}.csv`, toCsv(['Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax'], rows));
    };
    const exportHsn = () => {
        if (!data) return;
        const rows = data.hsnWise.map((h: any) => [h.hsn, h.name, rate(h.rate), h.qty, h.taxable, h.cgst ?? 0, h.sgst ?? 0, h.igst ?? 0, h.gst]);
        downloadFile(`gst-hsn-${month}.csv`, toCsv(['HSN', 'Description', 'Rate', 'Qty', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax'], rows));
    };
    const exportItc = () => {
        if (!data?.itc) return;
        const rows = data.itc.list.map((b: any) => [b.supplierGstin, b.supplierName, b.supplierInvoiceNo, b.supplierInvoiceDate ? String(b.supplierInvoiceDate).slice(0, 10) : '', b.poNo, b.taxable, b.cgst, b.sgst, b.igst, b.gst, b.total]);
        downloadFile(`input-tax-credit-${month}.csv`, toCsv(['Supplier GSTIN', 'Supplier', 'Bill No', 'Bill Date', 'Our PO', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Bill Value'], rows));
    };
    const exportB2b = () => {
        if (!data) return;
        const rows = data.b2b.map((b: any) => [b.gstin, b.name, b.invoices, b.taxable, b.gst, b.igst ?? 0, b.total]);
        downloadFile(`gstr1-b2b-${month}.csv`, toCsv(['GSTIN', 'Party', 'Invoices', 'Taxable', 'Tax', 'of which IGST', 'Invoice Value'], rows));
    };

    const tiles = [
        { label: t('taxableValue'), value: sum?.taxableValue, icon: RupeeIcon, tone: { bg: 'var(--brand-tint)', fg: 'var(--brand-text)' } },
        { label: t('totalTax'), value: sum?.totalTax, icon: Percent, tone: { bg: 'var(--warning-tint)', fg: 'var(--warning)' } },
        { label: t('invoiceValue'), value: sum?.invoiceValue, icon: FileSpreadsheet, tone: { bg: 'var(--success-tint)', fg: 'var(--success)' } },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('gstReturns')}</h1>
                <input type="month" className="wp-input !w-auto" value={month} max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`} onChange={(e) => setMonth(e.target.value)} />
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {tiles.map((tile) => (
                    <div key={tile.label} className="wp-card p-5">
                        <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: tile.tone.bg, color: tile.tone.fg }}><tile.icon size={18} /></div>
                        <p className="mt-3 text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(tile.value || 0)}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tile.label}</p>
                    </div>
                ))}
            </div>

            {/* GSTR-3B summary */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><FileSpreadsheet size={17} style={{ color: 'var(--brand-text)' }} /> {t('gstr3bSummary')}</h3>
                    <button className="wp-btn wp-btn-ghost" onClick={exportGstr3b} disabled={!sum?.invoices}><Download size={15} /> {t('exportCsv')}</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[['CGST', sum?.cgst], ['SGST', sum?.sgst], ['IGST', sum?.igst], [t('totalTax'), sum?.totalTax]].map(([l, v]: any) => (
                        <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</p>
                            <p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(v || 0)}</p>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>{t('gstIntraStateNote')}</p>
            </div>

            {/* Rate-wise (B2C) */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Percent size={17} style={{ color: 'var(--brand-text)' }} /> {t('rateWise')}</h3>
                    <button className="wp-btn wp-btn-ghost" onClick={exportRateWise} disabled={!(data?.rateWise || []).length}><Download size={15} /> {t('exportCsv')}</button>
                </div>
                <div className="space-y-2">
                    {(data?.rateWise || []).map((r: any) => (
                        <div key={r.rate} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="wp-chip font-bold" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{rate(r.rate)} GST</span>
                                <div className="text-right">
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('totalTax')}</p>
                                    <p className="text-base font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>{inr(r.gst)}</p>
                                </div>
                            </div>
                            {/* IGST only shows when this rate has sales to other-state buyers. */}
                            <div className={`grid gap-2 ${r.igst > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                                {[[t('taxableValue'), r.taxable], ['CGST', r.cgst], ['SGST', r.sgst], ...(r.igst > 0 ? [['IGST', r.igst]] : [])].map(([l, v]: any) => (
                                    <div key={l}>
                                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{l}</p>
                                        <p className="text-sm font-semibold tabular" style={{ color: 'var(--text-secondary)' }}>{inr(v)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!(data?.rateWise || []).length && <p className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{t('noGstData')}</p>}
                </div>
            </div>

            {/* HSN summary */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><FileSpreadsheet size={17} style={{ color: 'var(--brand-text)' }} /> {t('hsnSummary')}</h3>
                    <button className="wp-btn wp-btn-ghost" onClick={exportHsn} disabled={!(data?.hsnWise || []).length}><Download size={15} /> {t('exportCsv')}</button>
                </div>
                <div className="space-y-2">
                    {(data?.hsnWise || []).map((h: any, i: number) => (
                        <div key={i} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{h.name}</p>
                                    <p className="text-[11px] tabular" style={{ color: 'var(--text-muted)' }}>HSN {h.hsn}</p>
                                </div>
                                <span className="wp-chip font-bold shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{rate(h.rate)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[[t('qtyWord'), h.qty], [t('taxableValue'), inr(h.taxable)], [t('totalTax'), inr(h.gst)]].map(([l, v]: any) => (
                                    <div key={l}>
                                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{l}</p>
                                        <p className="text-sm font-semibold tabular" style={{ color: 'var(--text-secondary)' }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!(data?.hsnWise || []).length && <p className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{t('noGstData')}</p>}
                </div>
            </div>

            {/* Input tax credit — GST on purchases received this month from registered suppliers */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Truck size={17} style={{ color: 'var(--brand-text)' }} /> {t('itcTitle')} <span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{data?.itc?.bills || 0}</span></h3>
                    <button className="wp-btn wp-btn-ghost" onClick={exportItc} disabled={!data?.itc?.bills}><Download size={15} /> {t('exportCsv')}</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[['CGST', data?.itc?.cgst], ['SGST', data?.itc?.sgst], ['IGST', data?.itc?.igst], [t('totalTax'), data?.itc?.total]].map(([l, v]: any) => (
                        <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</p>
                            <p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--success)' }}>{inr(v || 0)}</p>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>{t('itcNote')}</p>
                {(data?.itc?.missingBillNo || 0) > 0 && <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>{data.itc.missingBillNo} {t('itcMissingBillNo')}</p>}
                {(data?.itc?.noCredit?.bills || 0) > 0 && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('itcNoCredit')} {inr(data.itc.noCredit.gst)} ({data.itc.noCredit.bills})</p>}
            </div>

            {/* GST to pay after credit (estimate) */}
            {data?.gstToPay && (
                <div className="wp-card p-5">
                    <h3 className="font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}><Scale size={17} style={{ color: 'var(--brand-text)' }} /> {t('gstToPayTitle')}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        {[['CGST', data.gstToPay.payable.cgst], ['SGST', data.gstToPay.payable.sgst], ['IGST', data.gstToPay.payable.igst], [t('totalWord'), data.gstToPay.payable.total]].map(([l, v]: any) => (
                            <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</p>
                                <p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(v || 0)}</p>
                            </div>
                        ))}
                    </div>
                    {data.gstToPay.carryForward.total > 0 && <p className="text-xs mt-2" style={{ color: 'var(--success)' }}>{t('creditCarried')} {inr(data.gstToPay.carryForward.total)}</p>}
                    <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{t('gstToPayNote')}</p>
                </div>
            )}

            {/* B2B */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Building2 size={17} style={{ color: 'var(--brand-text)' }} /> {t('b2bInvoices')} <span className="wp-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{(data?.b2b || []).length}</span></h3>
                    <button className="wp-btn wp-btn-ghost" onClick={exportB2b} disabled={!(data?.b2b || []).length}><Download size={15} /> {t('exportCsv')}</button>
                </div>
                {!(data?.b2b || []).length && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Users size={14} /> {t('noB2b')}</p>}
                <div className="space-y-2">
                    {(data?.b2b || []).map((b: any) => (
                        <div key={b.gstin} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.name || '—'}</p>
                                <p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{b.gstin} · {b.invoices} {t('invoicesWord')}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(b.total)}</p>
                                <p className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{t('tax')} {inr(b.gst)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
