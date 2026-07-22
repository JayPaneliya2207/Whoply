'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, ShoppingCart, Check, X, MessageCircle, Printer, UserRound, QrCode, BadgeCheck } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { UpiQr } from '@/components/UpiQr';
import { CatIcon } from '@/lib/icons';
import { SearchInput } from '@/components/SearchInput';
import { ScanButton, useWedgeScanner } from '@/components/BarcodeScanner';
import { Modal } from '@/components/Modal';
import { usePos } from '@/stores/pos.store';
import { buildBillText, whatsappLink, printBill } from '@/lib/bill';

export default function BillingPage() {
    const qc = useQueryClient();
    const { cart, name, mobile, setName, setMobile, add, setQty, remove, clear } = usePos();
    const [search, setSearch] = useState('');
    const [payment, setPayment] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
    const [done, setDone] = useState<any>(null);
    const [error, setError] = useState('');
    const [showQr, setShowQr] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [flash, setFlash] = useState('');

    const { data: prodData } = useQuery({
        queryKey: ['products', search],
        queryFn: async () => (await api.get(`/shopkeeper/products?limit=60&search=${encodeURIComponent(search)}`)).data.data.items,
    });
    const { data: customers } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await api.get('/shopkeeper/customers?limit=200')).data.data.items,
    });

    const matched = useMemo(() => {
        if (mobile.length < 10) return null;
        return (customers || []).find((c: any) => String(c.mobile || '').replace(/\D/g, '').endsWith(mobile)) || null;
    }, [mobile, customers]);
    useEffect(() => { if (matched) setName(matched.name); }, [matched, setName]);

    const flashMsg = useCallback((m: string) => { setFlash(m); setTimeout(() => setFlash(''), 1800); }, []);

    const scanAdd = useCallback(async (code: string) => {
        const local = (prodData || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`/shopkeeper/products?barcode=${encodeURIComponent(code)}`)).data.data.items[0];
        if (!target) { flashMsg(`No product for ${code}`); return; }
        if (target.currentStock <= 0) { flashMsg(`${target.name} is out of stock`); return; }
        add(target);
        flashMsg(`Added ${target.name}`);
    }, [prodData, add, flashMsg]);

    useWedgeScanner(scanAdd);

    const totals = useMemo(() => {
        let sub = 0, gst = 0;
        cart.forEach((r) => { const base = r.price * r.qty; sub += base; gst += (base * r.gstRate) / 100; });
        return { sub, gst, grand: sub + gst };
    }, [cart]);
    const count = useMemo(() => cart.reduce((s, r) => s + r.qty, 0), [cart]);
    const inCart = useMemo(() => new Map(cart.map((r) => [r.productId, r.qty])), [cart]);
    const creditBlocked = payment === 'credit' && !matched && mobile.length < 10;

    const checkout = useMutation({
        mutationFn: async () => {
            const body = {
                items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })),
                paymentMode: payment,
                customerId: matched?._id || undefined,
                walkInName: !matched ? name || undefined : undefined,
                walkInMobile: !matched ? mobile || undefined : undefined,
            };
            return (await api.post('/shopkeeper/billing', body)).data.data;
        },
        onSuccess: (inv) => {
            setDone(inv); clear(); setPayment('cash'); setError(''); setCartOpen(false);
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['bills'] });
            qc.invalidateQueries({ queryKey: ['customers-all'] });
        },
        onError: (e) => setError(apiErr(e)),
    });

    const fetchBill = async (id: string) => (await api.get(`/shopkeeper/billing/${id}`)).data.data;
    const shareBill = async (id: string) => {
        const inv = await fetchBill(id);
        if (!inv.customerMobile) { alert('No customer mobile on this bill. Add a mobile at billing time to send on WhatsApp.'); return; }
        window.open(whatsappLink(inv.customerMobile, buildBillText(inv, inv.business), inv.business?.countryCode || '+91'), '_blank');
    };
    const openPrint = async (id: string) => { const inv = await fetchBill(id); printBill(inv, inv.business); };

    return (
        <div className="pb-24">
            {/* Product picker */}
            <div className="wp-card p-4 sm:p-5">
                <div className="flex gap-2 mb-4">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search by name, barcode or SKU…" />
                    <ScanButton onScan={scanAdd} label="Scan" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(prodData || []).map((p: any) => {
                        const qty = inCart.get(p._id) || 0;
                        const out = p.currentStock <= 0;
                        return (
                            <div key={p._id} className="wp-card p-3 relative" style={qty ? { borderColor: 'var(--brand-600)', boxShadow: '0 0 0 1px var(--brand-600)' } : {}}>
                                {qty > 0 && (
                                    <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1.5 grid place-items-center rounded-full text-xs font-bold z-10" style={{ background: 'var(--brand-700)', color: '#fff' }}>{qty}</span>
                                )}
                                <button onClick={() => !out && add(p)} disabled={out} className="text-left w-full disabled:opacity-40">
                                    <div className="mb-2"><CatIcon name={p.categoryId?.name || p.name} /></div>
                                    <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--brand-700)' }}>{inr2(p.sellPrice)}</p>
                                    <p className="text-xs" style={{ color: p.currentStock <= p.lowStockThreshold ? 'var(--accent-600)' : 'var(--text-muted)' }}>Stock: {p.currentStock}</p>
                                </button>
                                {qty > 0 && (
                                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                                        <button onClick={() => (qty <= 1 ? remove(p._id) : setQty(p._id, -1))} className="h-7 w-7 grid place-items-center rounded-lg" style={{ background: 'var(--surface-2)' }}>{qty <= 1 ? <Trash2 size={13} style={{ color: 'var(--danger-500)' }} /> : <Minus size={14} />}</button>
                                        <span className="text-sm font-bold tabular">{qty}</span>
                                        <button onClick={() => setQty(p._id, 1)} disabled={qty >= p.currentStock} className="h-7 w-7 grid place-items-center rounded-lg disabled:opacity-40" style={{ background: 'var(--brand-700)', color: '#fff' }}><Plus size={14} /></button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {(prodData || []).length === 0 && <p className="col-span-full text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No products found.</p>}
                </div>
            </div>

            {/* scan / add flash */}
            <AnimatePresence>
                {flash && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 wp-card px-4 py-2 z-[80] text-sm font-semibold" style={{ boxShadow: 'var(--shadow-lg)', color: 'var(--text-primary)' }}>
                        {flash}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating cart bar */}
            <AnimatePresence>
                {cart.length > 0 && !cartOpen && (
                    <motion.button initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={() => setCartOpen(true)}
                        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md wp-btn wp-btn-primary !py-3.5 !rounded-2xl flex items-center justify-between" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <span className="flex items-center gap-2"><span className="relative"><ShoppingCart size={20} /><span className="absolute -top-2 -right-2 h-4 min-w-4 px-1 grid place-items-center rounded-full text-[10px] font-bold" style={{ background: '#fff', color: 'var(--brand-700)' }}>{count}</span></span> View cart</span>
                        <span className="font-extrabold tabular">{inr2(totals.grand)}</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Cart popup — shared gesture Modal */}
            <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`Cart (${count})`}
                footer={
                    <div className="space-y-2">
                        {payment === 'upi' && <button className="wp-btn wp-btn-ghost w-full" onClick={() => setShowQr(true)}><QrCode size={16} /> Show UPI QR</button>}
                        {error && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                        {creditBlocked && <p className="text-xs" style={{ color: 'var(--accent-600)' }}>Enter a mobile number for udhar (credit) sales.</p>}
                        <button className="wp-btn wp-btn-primary w-full" disabled={cart.length === 0 || checkout.isPending || creditBlocked} onClick={() => checkout.mutate()}>
                            <Check size={18} /> Complete Sale · {inr2(totals.grand)}
                        </button>
                    </div>
                }>
                {cart.length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Your cart is empty.</p>}

                {/* items — 2 per row */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <AnimatePresence>
                        {cart.map((r) => (
                            <motion.div key={r.productId} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                                className="rounded-xl p-2.5" style={{ background: 'var(--surface-2)' }}>
                                <div className="flex items-start justify-between gap-1">
                                    <p className="text-sm font-medium leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                                    <button onClick={() => remove(r.productId)} className="shrink-0" style={{ color: 'var(--danger-500)' }}><Trash2 size={14} /></button>
                                </div>
                                <p className="text-xs mt-1 mb-2" style={{ color: 'var(--text-muted)' }}>{inr2(r.price)} · <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{inr2(r.price * r.qty)}</span></p>
                                <div className="flex items-center justify-between">
                                    <button onClick={() => setQty(r.productId, -1)} className="h-7 w-7 grid place-items-center rounded-md" style={{ background: 'var(--card-bg)' }}><Minus size={13} /></button>
                                    <span className="text-sm font-bold tabular">{r.qty}</span>
                                    <button onClick={() => setQty(r.productId, 1)} className="h-7 w-7 grid place-items-center rounded-md" style={{ background: 'var(--card-bg)' }}><Plus size={13} /></button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Customer */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="relative">
                        <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input className="wp-input pl-9 text-sm" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <input className="wp-input text-sm" inputMode="numeric" placeholder="Mobile number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
                {matched && <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--success-600)' }}><BadgeCheck size={13} /> Existing customer{matched.creditBalance > 0 ? ` · owes ${inr2(matched.creditBalance)}` : ''}</p>}

                <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {(['cash', 'upi', 'card', 'credit'] as const).map((m) => (
                        <button key={m} onClick={() => setPayment(m)} className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                            style={payment === m ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{m}</button>
                    ))}
                </div>

                <div className="space-y-1 text-sm">
                    <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Subtotal</span><span className="tabular">{inr2(totals.sub)}</span></div>
                    <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>GST</span><span className="tabular">{inr2(totals.gst)}</span></div>
                    <div className="flex justify-between text-lg font-extrabold pt-1" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--card-border)' }}><span>Total</span><span className="tabular">{inr2(totals.grand)}</span></div>
                </div>
            </Modal>

            {/* success toast with share/print */}
            <AnimatePresence>
                {done && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 wp-card p-4 z-[55] w-[92vw] max-w-md" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--success-500)', color: '#fff' }}><Check size={18} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sale recorded · {done.invoiceNo}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{inr2(done.grandTotal)} · {done.customerName || 'Walk-in'}{done.customerMobile ? ` · ${done.customerMobile}` : ''}</p>
                            </div>
                            <button onClick={() => setDone(null)}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button className="wp-btn wp-btn-ghost flex-1 !py-2 text-sm" onClick={() => shareBill(done._id)}><MessageCircle size={15} style={{ color: 'var(--success-600)' }} /> WhatsApp bill</button>
                            <button className="wp-btn wp-btn-ghost flex-1 !py-2 text-sm" onClick={() => openPrint(done._id)}><Printer size={15} /> Print / PDF</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showQr && <UpiQr amount={totals.grand} note="POS sale" onClose={() => setShowQr(false)} />}
        </div>
    );
}
