'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Pencil, Trash2, PackageCheck, Search, Minus, Check, ClipboardList } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { stepQty } from '@/lib/qty';
import { QtyInput } from '@/components/QtyInput';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { ScanButton } from '@/components/BarcodeScanner';
import { useT } from '@/i18n';
import { useCan } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { priceLines } from '@/lib/tax';

/** Today in India time as YYYY-MM-DD (the bill date field's default and maximum). */
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

const emptySup = { name: '', mobile: '', country: '+91', gstin: '', address: '' };

export default function PurchasesPage() {
    const qc = useQueryClient();
    const t = useT();
    const can = useCan();
    // Shops and wholesalers both keep suppliers and purchase orders — same screens, their own API.
    const { user } = useAuth();
    const base = user?.business?.type === 'wholesale' ? '/wholesaler' : '/shopkeeper';
    const [supModal, setSupModal] = useState(false);
    const [editingSup, setEditingSup] = useState<any>(null);
    const [supForm, setSupForm] = useState<any>(emptySup);
    const [supErr, setSupErr] = useState('');
    const [delSup, setDelSup] = useState<any>(null);
    const [cancelPo, setCancelPo] = useState<any>(null);

    // PO builder
    const [poModal, setPoModal] = useState(false);
    const [poSupplier, setPoSupplier] = useState('');
    const [poPaid, setPoPaid] = useState('');
    const [poCart, setPoCart] = useState<any[]>([]);
    const [poSearch, setPoSearch] = useState('');
    const [poErr, setPoErr] = useState('');
    const [poIncl, setPoIncl] = useState(false); // typed costs already include GST
    const [poBill, setPoBill] = useState({ no: '', date: '' });
    // Receive (with the supplier's bill no./date) or fix the bill details later.
    const [billFor, setBillFor] = useState<{ po: any; receive: boolean } | null>(null);
    const [bill, setBill] = useState({ no: '', date: '' });
    const [billErr, setBillErr] = useState('');

    // Record a payment you make to the supplier (clears the PO's Due + supplier Payable)
    const [payPo, setPayPo] = useState<any>(null);
    const [payAmt, setPayAmt] = useState('');
    const [payErr, setPayErr] = useState('');

    const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get(`${base}/suppliers`)).data.data });
    const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: async () => (await api.get(`${base}/purchases?limit=50`)).data.data.items });
    const { data: products } = useQuery({ queryKey: ['pur-products', poSearch], queryFn: async () => (await api.get(`${base}/products?limit=50&search=${encodeURIComponent(poSearch)}`)).data.data.items, enabled: poModal });

    // ---- supplier CRUD ----
    const openNewSup = () => { setEditingSup(null); setSupForm(emptySup); setSupErr(''); setSupModal(true); };
    const openEditSup = (s: any) => { setEditingSup(s); setSupForm({ name: s.name, mobile: s.mobile || '', country: s.countryCode || '+91', gstin: s.gstin || '', address: s.address || '' }); setSupErr(''); setSupModal(true); };
    const saveSup = useMutation({
        mutationFn: async () => {
            const body = { name: supForm.name, mobile: supForm.mobile, countryCode: supForm.country, gstin: supForm.gstin, address: supForm.address };
            if (editingSup) return (await api.patch(`${base}/suppliers/${editingSup._id}`, body)).data.data;
            return (await api.post(`${base}/suppliers`, body)).data.data;
        },
        onSuccess: () => { setSupModal(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => setSupErr(apiErr(e)),
    });
    const doDelSup = useMutation({ mutationFn: async () => (await api.delete(`${base}/suppliers/${delSup._id}`)).data, onSuccess: () => { setDelSup(null); qc.invalidateQueries({ queryKey: ['suppliers'] }); }, onError: (e) => { setDelSup(null); alert(apiErr(e)); } });

    // ---- purchase order ----
    const addPo = (p: any) => setPoCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c; return [...c, { productId: p._id, name: p.name, costPrice: p.costPrice, unit: p.unit, gstRate: p.gstRate || 0, quantity: 10 }]; });
    const scanAddPo = async (code: string) => {
        const local = (products || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`${base}/products?barcode=${encodeURIComponent(code)}`)).data.data.items[0];
        if (target) addPo(target);
    };
    const setPoQty = (id: string, d: number) => setPoCart((c) => c.map((r) => r.productId === id ? { ...r, quantity: stepQty(r.quantity, d, r.unit) } : r));
    const setPoQtyTo = (id: string, n: number) => setPoCart((c) => c.map((r) => r.productId === id ? { ...r, quantity: n } : r));
    const setPoCost = (id: string, v: string) => setPoCart((c) => c.map((r) => r.productId === id ? { ...r, costPrice: v } : r));
    // Priced like the server prices the order: GST per product on top of the cost (or inside it with the switch).
    const poPriced = useMemo(() => priceLines(poCart.map((r) => ({ unitPrice: Number(r.costPrice) || 0, quantity: r.quantity, gstRate: r.gstRate || 0, inclusive: poIncl })), 0), [poCart, poIncl]);
    const poTotal = poPriced.grandTotal;
    const resetPo = () => { setPoCart([]); setPoSupplier(''); setPoPaid(''); setPoErr(''); setPoIncl(false); setPoBill({ no: '', date: '' }); };
    const createPo = useMutation({
        mutationFn: async () => (await api.post(`${base}/purchases`, { supplierId: poSupplier, paidAmount: Number(poPaid) || 0, items: poCart.map((r) => ({ productId: r.productId, quantity: r.quantity, costPrice: Number(r.costPrice) || 0 })), pricesIncludeGst: poIncl, supplierInvoiceNo: poBill.no.trim() || undefined, supplierInvoiceDate: poBill.date || undefined })).data.data,
        onSuccess: () => { setPoModal(false); resetPo(); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => setPoErr(apiErr(e)),
    });
    // Receive the goods (stock in) — or, for an order already received, just save the supplier's bill.
    const openBill = (po: any, receive: boolean) => { setBillFor({ po, receive }); setBill({ no: po.supplierInvoiceNo || '', date: po.supplierInvoiceDate ? String(po.supplierInvoiceDate).slice(0, 10) : '' }); setBillErr(''); };
    const saveBill = useMutation({
        mutationFn: async () => {
            const body = { supplierInvoiceNo: bill.no.trim() || undefined, supplierInvoiceDate: bill.date || undefined };
            if (billFor!.receive) return (await api.post(`${base}/purchases/${billFor!.po._id}/receive`, body)).data.data;
            return (await api.patch(`${base}/purchases/${billFor!.po._id}/bill`, body)).data.data;
        },
        onSuccess: () => { setBillFor(null); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
        onError: (e) => { setBillErr(apiErr(e)); qc.invalidateQueries({ queryKey: ['purchases'] }); },
    });
    // Cancel a PO entered by mistake (pending, nothing paid) — its due comes off the supplier.
    const doCancelPo = useMutation({
        mutationFn: async () => (await api.post(`${base}/purchases/${cancelPo._id}/cancel`)).data.data,
        onSuccess: () => { setCancelPo(null); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => { setCancelPo(null); alert(apiErr(e)); },
    });

    const openPay = (po: any) => { setPayPo(po); setPayAmt(String(po.dueAmount)); setPayErr(''); };
    const recordPayment = useMutation({
        mutationFn: async () => (await api.post(`${base}/purchases/${payPo._id}/payment`, { amount: Number(payAmt) })).data.data,
        onSuccess: () => { setPayPo(null); setPayAmt(''); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => setPayErr(apiErr(e)),
    });

    const setSup = (k: string, v: any) => setSupForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-6">
            {/* Suppliers */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('suppliersTitle')}</h1>
                    {can('purchases.manage') && <button className="wp-btn wp-btn-primary" onClick={openNewSup}><Plus size={16} /> {t('addSupplier')}</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(suppliers || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('addSuppliersFirst')}</p>}
                    {(suppliers || []).map((s: any) => (
                        <div key={s._id} className="wp-card wp-card-hover p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}><Truck size={18} /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.mobile || 'No contact'}{s.gstin ? ` · ${s.gstin}` : ''}</p>
                                </div>
                                {can('purchases.manage') && <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEditSup(s)}><Pencil size={14} /></button>}
                                {can('purchases.manage') && <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDelSup(s)}><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>}
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('youOwePayable')}</span>
                                <span className="font-bold tabular" style={{ color: s.payableBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>{inr2(s.payableBalance)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Purchase orders */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><ClipboardList size={18} /> {t('purchaseOrders')}</h2>
                    {can('purchases.manage') && <button className="wp-btn wp-btn-ghost" onClick={() => { setPoModal(true); setPoErr(''); }} disabled={!(suppliers || []).length}><Plus size={16} /> {t('newPo')}</button>}
                </div>
                {(purchases || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noPurchaseOrders')}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(purchases || []).map((p: any) => (
                        <div key={p._id} className="wp-card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.poNo}</p>
                                <span className="wp-chip capitalize shrink-0" style={p.status === 'received' ? { background: 'var(--success-tint)', color: 'var(--success)' } : p.status === 'cancelled' ? { background: 'var(--danger-tint)', color: 'var(--danger)' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{p.status === 'cancelled' ? t('poCancelled') : p.status}</span>
                            </div>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.supplierName}</p>
                            {p.status !== 'cancelled' && (
                                <button className="text-xs mb-2 flex items-center gap-1 disabled:cursor-default" disabled={!can('purchases.manage')} onClick={() => openBill(p, false)} style={{ color: p.supplierInvoiceNo ? 'var(--text-secondary)' : 'var(--warning)' }}>
                                    {p.supplierInvoiceNo ? `${t('supplierBillNo')} ${p.supplierInvoiceNo}` : t('addBillNo')}{can('purchases.manage') && <Pencil size={11} />}
                                </button>
                            )}
                            <div className="flex items-end justify-between gap-2">
                                <div>
                                    <p className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(p.total)}</p>
                                    {p.totalGst > 0 && <p className="text-[11px] tabular" style={{ color: 'var(--text-muted)' }}>{t('inclGst')} {inr2(p.totalGst)}</p>}
                                    {p.status === 'cancelled' ? null : p.dueAmount > 0
                                        ? <p className="text-xs tabular" style={{ color: 'var(--warning)' }}>You owe {inr2(p.dueAmount)}</p>
                                        : <p className="text-xs" style={{ color: 'var(--success)' }}>{t('fullyPaid')}</p>}
                                </div>
                                <div className="flex flex-col gap-1.5 items-stretch shrink-0">
                                    {can('purchases.manage') && p.status === 'pending' && <button className="wp-btn wp-btn-primary !py-1.5 !text-xs" onClick={() => openBill(p, true)}><PackageCheck size={13} /> {t('receiveStock')}</button>}
                                    {can('purchases.manage') && p.status !== 'cancelled' && p.dueAmount > 0 && <button className="wp-btn wp-btn-ghost !py-1.5 !text-xs" onClick={() => openPay(p)}><RupeeIcon size={13} /> {t('recordPaymentBtn')}</button>}
                                    {can('purchases.manage') && p.status === 'pending' && !(p.paidAmount > 0) && <button className="text-xs font-semibold py-1" style={{ color: 'var(--danger)' }} onClick={() => setCancelPo(p)}>{t('cancelPo')}</button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Supplier modal */}
            <Modal open={supModal} onClose={() => setSupModal(false)} title={editingSup ? t('editSupplier') : t('addSupplier')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={saveSup.isPending || !supForm.name} onClick={() => saveSup.mutate()}>{editingSup ? t('save') : t('addSupplier')}</button>}>
                <Field label={t('supplierNameLabel')}><input className="wp-input" value={supForm.name} onChange={(e) => setSup('name', e.target.value)} placeholder="e.g. Metro Wholesale Mart" autoFocus /></Field>
                <Field label="Mobile"><PhoneInput value={supForm.mobile} onChange={(v) => setSup('mobile', v)} country={supForm.country} onCountryChange={(c) => setSup('country', c)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="GSTIN"><input className="wp-input uppercase" value={supForm.gstin} onChange={(e) => setSup('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" maxLength={15} /></Field>
                    <Field label={t('cityAddress')}><input className="wp-input" value={supForm.address} onChange={(e) => setSup('address', e.target.value)} placeholder="Optional" /></Field>
                </div>
                {supErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{supErr}</p>}
            </Modal>

            {/* PO modal */}
            <Modal open={poModal} onClose={() => { setPoModal(false); resetPo(); }} title={t('newPurchaseOrder')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={createPo.isPending || !poSupplier || !poCart.length} onClick={() => createPo.mutate()}><Check size={16} /> {t('createPo')} · {inr2(poTotal)}</button>}>
                <Field label="Supplier"><select className="wp-input" value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}><option value="">{t('selectSupplier')}</option>{(suppliers || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
                <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input className="wp-input pl-9" placeholder="Search name, barcode or SKU…" value={poSearch} onChange={(e) => setPoSearch(e.target.value)} />
                    </div>
                    <ScanButton onScan={scanAddPo} label="Scan" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto wp-scroll mb-3">
                    {(products || []).map((p: any) => (
                        <button key={p._id} onClick={() => addPo(p)} className="wp-card p-2 text-left"><p className="text-xs font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>{p.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>cost {inr2(p.costPrice)}</p></button>
                    ))}
                </div>
                <div className="space-y-1.5 mb-3">
                    {poCart.map((r) => (
                        <div key={r.productId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.name} <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>GST {r.gstRate || 0}%</span></span>
                            <button onClick={() => setPoQty(r.productId, -1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Minus size={12} /></button>
                            <QtyInput value={r.quantity} unit={r.unit} onChange={(n) => setPoQtyTo(r.productId, n)} label={`${t('qtyWord')} · ${r.name}`} className="w-14" />
                            <button onClick={() => setPoQty(r.productId, 1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Plus size={12} /></button>
                            <input className="wp-input !py-1 !px-2 w-20 text-sm tabular text-right" type="number" value={r.costPrice} onChange={(e) => setPoCost(r.productId, e.target.value)} placeholder="cost" />
                            <button onClick={() => setPoCart((c) => c.filter((x) => x.productId !== r.productId))}><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>
                        </div>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={poIncl} onChange={(e) => setPoIncl(e.target.checked)} /> {t('costIncludesGst')}
                </label>
                {poCart.length > 0 && (
                    <div className="rounded-xl p-3 mb-3 space-y-1 text-sm" style={{ background: 'var(--surface-2)' }}>
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>{t('beforeGst')}</span><span className="tabular">{inr2(poPriced.subtotal)}</span></div>
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>GST</span><span className="tabular">{inr2(poPriced.totalGst)}</span></div>
                        <div className="flex justify-between font-bold" style={{ color: 'var(--text-primary)' }}><span>{t('totalWord')}</span><span className="tabular">{inr2(poTotal)}</span></div>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('supplierBillNo')}><input className="wp-input" maxLength={16} value={poBill.no} onChange={(e) => setPoBill((b) => ({ ...b, no: e.target.value }))} placeholder={t('optionalWord')} /></Field>
                    <Field label={t('supplierBillDate')}><input className="wp-input" type="date" max={todayIst()} value={poBill.date} onChange={(e) => setPoBill((b) => ({ ...b, date: e.target.value }))} /></Field>
                </div>
                <Field label={t('paidNowRs')}><input className="wp-input tabular" type="number" value={poPaid} onChange={(e) => setPoPaid(e.target.value)} placeholder="0" /></Field>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock is added when you tap “Receive” on the PO.</p>
                {poErr && <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>{poErr}</p>}
            </Modal>

            {/* Record a payment you make to the supplier */}
            <Modal open={!!payPo} onClose={() => setPayPo(null)} title={t('recordPaymentToSupplier')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={recordPayment.isPending || !Number(payAmt)} onClick={() => recordPayment.mutate()}><Check size={16} /> {t('confirmPayment')}</button>}>
                {payPo && (
                    <>
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{payPo.poNo} · {payPo.supplierName}</p>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>You owe <b style={{ color: 'var(--warning)' }}>{inr2(payPo.dueAmount)}</b> on this order.</p>
                        <Field label="Amount you are paying now ₹"><input className="wp-input tabular" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus /></Field>
                        {payErr && <p className="text-sm" style={{ color: 'var(--danger)' }}>{payErr}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This reduces the order’s due and how much you owe this supplier.</p>
                    </>
                )}
            </Modal>

            {/* Receive stock — with the supplier's bill no./date (needed to claim GST credit) — or edit those later */}
            <Modal open={!!billFor} onClose={() => setBillFor(null)} title={billFor?.receive ? t('receiveStock') : t('supplierBillNo')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={saveBill.isPending} onClick={() => saveBill.mutate()}>{billFor?.receive ? <><PackageCheck size={16} /> {t('receiveStock')}</> : <><Check size={16} /> {t('save')}</>}</button>}>
                {billFor && (
                    <>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{billFor.po.poNo} · {billFor.po.supplierName}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('supplierBillNo')}><input className="wp-input" maxLength={16} value={bill.no} onChange={(e) => setBill((b) => ({ ...b, no: e.target.value }))} autoFocus /></Field>
                            <Field label={t('supplierBillDate')}><input className="wp-input" type="date" max={todayIst()} value={bill.date} onChange={(e) => setBill((b) => ({ ...b, date: e.target.value }))} /></Field>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{billFor.po.supplierGstin ? t('billForCredit') : t('noCreditUnregistered')}</p>
                        {billErr && <p className="text-sm mt-1" style={{ color: 'var(--danger)' }}>{billErr}</p>}
                    </>
                )}
            </Modal>

            <ConfirmDialog open={!!cancelPo} onClose={() => setCancelPo(null)} onConfirm={() => doCancelPo.mutate()} loading={doCancelPo.isPending} confirmLabel={t('cancelPo')} title={t('cancelPoTitle')} message={`${cancelPo?.poNo} · ${cancelPo?.supplierName} — ${t('cancelPoMsg')}`} />
            <ConfirmDialog open={!!delSup} onClose={() => setDelSup(null)} onConfirm={() => doDelSup.mutate()} loading={doDelSup.isPending} title="Remove supplier?" message={`Remove “${delSup?.name}”?`} />
        </div>
    );
}
