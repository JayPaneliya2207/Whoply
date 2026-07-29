'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Pencil, Trash2, PackageCheck, Search, Minus, Check, ClipboardList } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PhoneInput } from '@/components/PhoneInput';
import { ScanButton } from '@/components/BarcodeScanner';
import { useT } from '@/i18n';

const emptySup = { name: '', mobile: '', country: '+91', gstin: '', address: '' };

export default function PurchasesPage() {
    const qc = useQueryClient();
    const t = useT();
    const [supModal, setSupModal] = useState(false);
    const [editingSup, setEditingSup] = useState<any>(null);
    const [supForm, setSupForm] = useState<any>(emptySup);
    const [supErr, setSupErr] = useState('');
    const [delSup, setDelSup] = useState<any>(null);

    // PO builder
    const [poModal, setPoModal] = useState(false);
    const [poSupplier, setPoSupplier] = useState('');
    const [poPaid, setPoPaid] = useState('');
    const [poCart, setPoCart] = useState<any[]>([]);
    const [poSearch, setPoSearch] = useState('');
    const [poErr, setPoErr] = useState('');

    // Record a payment you make to the supplier (clears the PO's Due + supplier Payable)
    const [payPo, setPayPo] = useState<any>(null);
    const [payAmt, setPayAmt] = useState('');
    const [payErr, setPayErr] = useState('');

    const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api.get('/shopkeeper/suppliers')).data.data });
    const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: async () => (await api.get('/shopkeeper/purchases?limit=50')).data.data.items });
    const { data: products } = useQuery({ queryKey: ['pur-products', poSearch], queryFn: async () => (await api.get(`/shopkeeper/products?limit=50&search=${encodeURIComponent(poSearch)}`)).data.data.items, enabled: poModal });

    // ---- supplier CRUD ----
    const openNewSup = () => { setEditingSup(null); setSupForm(emptySup); setSupErr(''); setSupModal(true); };
    const openEditSup = (s: any) => { setEditingSup(s); setSupForm({ name: s.name, mobile: s.mobile || '', country: s.countryCode || '+91', gstin: s.gstin || '', address: s.address || '' }); setSupErr(''); setSupModal(true); };
    const saveSup = useMutation({
        mutationFn: async () => {
            const body = { name: supForm.name, mobile: supForm.mobile, countryCode: supForm.country, gstin: supForm.gstin, address: supForm.address };
            if (editingSup) return (await api.patch(`/shopkeeper/suppliers/${editingSup._id}`, body)).data.data;
            return (await api.post('/shopkeeper/suppliers', body)).data.data;
        },
        onSuccess: () => { setSupModal(false); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => setSupErr(apiErr(e)),
    });
    const doDelSup = useMutation({ mutationFn: async () => (await api.delete(`/shopkeeper/suppliers/${delSup._id}`)).data, onSuccess: () => { setDelSup(null); qc.invalidateQueries({ queryKey: ['suppliers'] }); } });

    // ---- purchase order ----
    const addPo = (p: any) => setPoCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c; return [...c, { productId: p._id, name: p.name, costPrice: p.costPrice, quantity: 10 }]; });
    const scanAddPo = async (code: string) => {
        const local = (products || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`/shopkeeper/products?barcode=${encodeURIComponent(code)}`)).data.data.items[0];
        if (target) addPo(target);
    };
    const setPoQty = (id: string, d: number) => setPoCart((c) => c.map((r) => r.productId === id ? { ...r, quantity: Math.max(1, r.quantity + d) } : r));
    const setPoCost = (id: string, v: string) => setPoCart((c) => c.map((r) => r.productId === id ? { ...r, costPrice: v } : r));
    const poTotal = useMemo(() => poCart.reduce((s, r) => s + (Number(r.costPrice) || 0) * r.quantity, 0), [poCart]);
    const createPo = useMutation({
        mutationFn: async () => (await api.post('/shopkeeper/purchases', { supplierId: poSupplier, paidAmount: Number(poPaid) || 0, items: poCart.map((r) => ({ productId: r.productId, quantity: r.quantity, costPrice: Number(r.costPrice) || 0 })) })).data.data,
        onSuccess: () => { setPoModal(false); setPoCart([]); setPoSupplier(''); setPoPaid(''); setPoErr(''); qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
        onError: (e) => setPoErr(apiErr(e)),
    });
    const receivePo = useMutation({
        mutationFn: async (id: string) => (await api.post(`/shopkeeper/purchases/${id}/receive`)).data.data,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    });

    const openPay = (po: any) => { setPayPo(po); setPayAmt(String(po.dueAmount)); setPayErr(''); };
    const recordPayment = useMutation({
        mutationFn: async () => (await api.post(`/shopkeeper/purchases/${payPo._id}/payment`, { amount: Number(payAmt) })).data.data,
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
                    <button className="wp-btn wp-btn-primary" onClick={openNewSup}><Plus size={16} /> {t('addSupplier')}</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(suppliers || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('addSuppliersFirst')}</p>}
                    {(suppliers || []).map((s: any) => (
                        <div key={s._id} className="wp-card wp-card-hover p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><Truck size={18} /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.mobile || 'No contact'}{s.gstin ? ` · ${s.gstin}` : ''}</p>
                                </div>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEditSup(s)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDelSup(s)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('youOwePayable')}</span>
                                <span className="font-bold tabular" style={{ color: s.payableBalance > 0 ? 'var(--accent-600)' : 'var(--success-600)' }}>{inr2(s.payableBalance)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Purchase orders */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><ClipboardList size={18} /> {t('purchaseOrders')}</h2>
                    <button className="wp-btn wp-btn-ghost" onClick={() => { setPoModal(true); setPoErr(''); }} disabled={!(suppliers || []).length}><Plus size={16} /> {t('newPo')}</button>
                </div>
                {(purchases || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noPurchaseOrders')}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(purchases || []).map((p: any) => (
                        <div key={p._id} className="wp-card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.poNo}</p>
                                <span className="wp-chip capitalize shrink-0" style={p.status === 'received' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{p.status}</span>
                            </div>
                            <p className="text-xs truncate mb-2" style={{ color: 'var(--text-muted)' }}>{p.supplierName}</p>
                            <div className="flex items-end justify-between gap-2">
                                <div>
                                    <p className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(p.total)}</p>
                                    {p.dueAmount > 0
                                        ? <p className="text-xs tabular" style={{ color: 'var(--accent-600)' }}>You owe {inr2(p.dueAmount)}</p>
                                        : <p className="text-xs" style={{ color: 'var(--success-600)' }}>{t('fullyPaid')}</p>}
                                </div>
                                <div className="flex flex-col gap-1.5 items-stretch shrink-0">
                                    {p.status === 'pending' && <button className="wp-btn wp-btn-primary !py-1.5 !text-xs" disabled={receivePo.isPending} onClick={() => receivePo.mutate(p._id)}><PackageCheck size={13} /> {t('receiveStock')}</button>}
                                    {p.dueAmount > 0 && <button className="wp-btn wp-btn-ghost !py-1.5 !text-xs" onClick={() => openPay(p)}><RupeeIcon size={13} /> {t('recordPaymentBtn')}</button>}
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
                {supErr && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{supErr}</p>}
            </Modal>

            {/* PO modal */}
            <Modal open={poModal} onClose={() => setPoModal(false)} title={t('newPurchaseOrder')}
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
                            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                            <button onClick={() => setPoQty(r.productId, -1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Minus size={12} /></button>
                            <span className="w-7 text-center text-sm tabular">{r.quantity}</span>
                            <button onClick={() => setPoQty(r.productId, 1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Plus size={12} /></button>
                            <input className="wp-input !py-1 !px-2 w-20 text-sm tabular text-right" type="number" value={r.costPrice} onChange={(e) => setPoCost(r.productId, e.target.value)} placeholder="cost" />
                            <button onClick={() => setPoCart((c) => c.filter((x) => x.productId !== r.productId))}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('paidNowRs')}><input className="wp-input tabular" type="number" value={poPaid} onChange={(e) => setPoPaid(e.target.value)} placeholder="0" /></Field>
                    <div className="flex items-end justify-end pb-3"><span className="font-bold text-lg tabular" style={{ color: 'var(--text-primary)' }}>{inr2(poTotal)}</span></div>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock is added when you tap “Receive” on the PO.</p>
                {poErr && <p className="text-sm mt-1" style={{ color: 'var(--danger-500)' }}>{poErr}</p>}
            </Modal>

            {/* Record a payment you make to the supplier */}
            <Modal open={!!payPo} onClose={() => setPayPo(null)} title={t('recordPaymentToSupplier')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={recordPayment.isPending || !Number(payAmt)} onClick={() => recordPayment.mutate()}><Check size={16} /> {t('confirmPayment')}</button>}>
                {payPo && (
                    <>
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{payPo.poNo} · {payPo.supplierName}</p>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>You owe <b style={{ color: 'var(--accent-600)' }}>{inr2(payPo.dueAmount)}</b> on this order.</p>
                        <Field label="Amount you are paying now ₹"><input className="wp-input tabular" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus /></Field>
                        {payErr && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{payErr}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This reduces the order’s due and how much you owe this supplier.</p>
                    </>
                )}
            </Modal>

            <ConfirmDialog open={!!delSup} onClose={() => setDelSup(null)} onConfirm={() => doDelSup.mutate()} loading={doDelSup.isPending} title="Remove supplier?" message={`Remove “${delSup?.name}”?`} />
        </div>
    );
}
