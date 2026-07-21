'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, ShoppingCart, Check, X } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { UpiQr } from '@/components/UpiQr';
import { QrCode } from 'lucide-react';
import { CatIcon } from '@/lib/icons';
import { SearchInput } from '@/components/SearchInput';

interface Row { productId: string; name: string; price: number; gstRate: number; unit: string; qty: number; stock: number; }

export default function BillingPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<Row[]>([]);
    const [payment, setPayment] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
    const [done, setDone] = useState<any>(null);
    const [error, setError] = useState('');
    const [showQr, setShowQr] = useState(false);

    const { data: prodData } = useQuery({
        queryKey: ['products', search],
        queryFn: async () => (await api.get(`/shopkeeper/products?limit=50&search=${encodeURIComponent(search)}`)).data.data.items,
    });
    const { data: customers } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await api.get('/shopkeeper/customers?limit=100')).data.data.items,
    });
    const [customerId, setCustomerId] = useState('');

    const add = (p: any) => {
        setCart((c) => {
            const ex = c.find((r) => r.productId === p._id);
            if (ex) return c.map((r) => (r.productId === p._id ? { ...r, qty: Math.min(r.qty + 1, r.stock) } : r));
            return [...c, { productId: p._id, name: p.name, price: p.sellPrice, gstRate: p.gstRate, unit: p.unit, qty: 1, stock: p.currentStock }];
        });
    };
    const setQty = (id: string, delta: number) =>
        setCart((c) => c.map((r) => (r.productId === id ? { ...r, qty: Math.max(1, Math.min(r.qty + delta, r.stock)) } : r)));
    const remove = (id: string) => setCart((c) => c.filter((r) => r.productId !== id));

    const totals = useMemo(() => {
        let sub = 0, gst = 0;
        cart.forEach((r) => { const base = r.price * r.qty; sub += base; gst += (base * r.gstRate) / 100; });
        return { sub, gst, grand: sub + gst };
    }, [cart]);

    const checkout = useMutation({
        mutationFn: async () => {
            const body = {
                items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })),
                paymentMode: payment,
                customerId: customerId || undefined,
            };
            return (await api.post('/shopkeeper/billing', body)).data.data;
        },
        onSuccess: (inv) => {
            setDone(inv); setCart([]); setCustomerId(''); setPayment('cash'); setError('');
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (e) => setError(apiErr(e)),
    });

    return (
        <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
            {/* Product picker */}
            <div className="wp-card p-5">
                <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search products by name…" /></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto wp-scroll">
                    {(prodData || []).map((p: any) => (
                        <button
                            key={p._id}
                            onClick={() => add(p)}
                            disabled={p.currentStock <= 0}
                            className="wp-card wp-card-hover p-3 text-left disabled:opacity-40"
                        >
                            <div className="mb-2"><CatIcon name={p.categoryId?.name || p.name} /></div>
                            <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-sm font-bold mt-1" style={{ color: 'var(--brand-700)' }}>{inr2(p.sellPrice)}</p>
                            <p className="text-xs" style={{ color: p.currentStock <= p.lowStockThreshold ? 'var(--accent-600)' : 'var(--text-muted)' }}>Stock: {p.currentStock}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Cart */}
            <div className="wp-card p-5 lg:sticky lg:top-20">
                <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
                    <ShoppingCart size={18} /> Cart ({cart.length})
                </h3>

                {cart.length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Tap products to add them</p>}

                <div className="space-y-2 max-h-[38vh] overflow-y-auto wp-scroll mb-3">
                    <AnimatePresence>
                        {cart.map((r) => (
                            <motion.div key={r.productId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                                className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inr2(r.price)} × {r.qty}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setQty(r.productId, -1)} className="h-6 w-6 grid place-items-center rounded-md" style={{ background: 'var(--card-bg)' }}><Minus size={12} /></button>
                                    <span className="w-6 text-center text-sm font-semibold tabular">{r.qty}</span>
                                    <button onClick={() => setQty(r.productId, 1)} className="h-6 w-6 grid place-items-center rounded-md" style={{ background: 'var(--card-bg)' }}><Plus size={12} /></button>
                                </div>
                                <button onClick={() => remove(r.productId)} style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* customer + payment */}
                <select className="wp-input mb-2 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Walk-in customer</option>
                    {(customers || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}{c.creditBalance > 0 ? ` (owes ${inr2(c.creditBalance)})` : ''}</option>)}
                </select>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {(['cash', 'upi', 'card', 'credit'] as const).map((m) => (
                        <button key={m} onClick={() => setPayment(m)} className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                            style={payment === m ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{m}</button>
                    ))}
                </div>

                <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Subtotal</span><span className="tabular">{inr2(totals.sub)}</span></div>
                    <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>GST</span><span className="tabular">{inr2(totals.gst)}</span></div>
                    <div className="flex justify-between text-lg font-extrabold pt-1" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--card-border)' }}><span>Total</span><span className="tabular">{inr2(totals.grand)}</span></div>
                </div>

                {payment === 'upi' && cart.length > 0 && (
                    <button className="wp-btn wp-btn-ghost w-full mb-2" onClick={() => setShowQr(true)}><QrCode size={16} /> Show UPI QR</button>
                )}

                {error && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                {payment === 'credit' && !customerId && <p className="text-xs mb-2" style={{ color: 'var(--accent-600)' }}>Select a customer for udhar (credit) sales.</p>}

                <button
                    className="wp-btn wp-btn-primary w-full"
                    disabled={cart.length === 0 || checkout.isPending || (payment === 'credit' && !customerId)}
                    onClick={() => checkout.mutate()}
                >
                    <Check size={18} /> Complete Sale · {inr2(totals.grand)}
                </button>
            </div>

            {/* success toast */}
            <AnimatePresence>
                {done && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 wp-card p-4 flex items-center gap-3 z-50" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <div className="h-9 w-9 grid place-items-center rounded-full" style={{ background: 'var(--success-500)', color: '#fff' }}><Check size={18} /></div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sale recorded · {done.invoiceNo}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{inr2(done.grandTotal)} · {done.status}</p>
                        </div>
                        <button onClick={() => setDone(null)}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {showQr && <UpiQr amount={totals.grand} note="POS sale" onClose={() => setShowQr(false)} />}
        </div>
    );
}
