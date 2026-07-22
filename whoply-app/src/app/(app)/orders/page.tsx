'use client';
import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, Check, X, Search, Eye, Download, Printer, MessageCircle } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { Modal } from '@/components/Modal';
import { ScanButton, useWedgeScanner } from '@/components/BarcodeScanner';
import { ordersToCsv, printOrder, downloadFile, buildOrderText, whatsappLink } from '@/lib/bill';

const statusTone: Record<string, any> = {
    pending: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    confirmed: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    dispatched: { background: '#fef3c7', color: 'var(--accent-600)' },
    delivered: { background: '#dcfce7', color: 'var(--success-600)' },
    cancelled: { background: '#fee2e2', color: 'var(--danger-500)' },
};
const FILTERS = ['all', 'pending', 'confirmed', 'dispatched', 'delivered'] as const;

export default function OrdersPage() {
    const qc = useQueryClient();
    const { user } = useAuth();
    const biz = user?.business ? { name: user.business.name, gstin: user.business.gstin } : undefined;
    const initialStatus = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') || 'all' : 'all';

    const [creating, setCreating] = useState(false);
    const [dealerId, setDealerId] = useState('');
    const [source, setSource] = useState('manual');
    const [cart, setCart] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [flash, setFlash] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
    const [detail, setDetail] = useState<any>(null);
    const [done, setDone] = useState<any>(null);

    const { data: allOrders } = useQuery({
        queryKey: ['orders'],
        queryFn: async () => (await api.get('/wholesaler/orders?limit=100')).data.data.items,
    });
    const orders = useMemo(() => (statusFilter === 'all' ? (allOrders || []) : (allOrders || []).filter((o: any) => o.status === statusFilter)), [allOrders, statusFilter]);
    const counts = useMemo(() => {
        const c: Record<string, number> = { all: (allOrders || []).length };
        (allOrders || []).forEach((o: any) => { c[o.status] = (c[o.status] || 0) + 1; });
        return c;
    }, [allOrders]);
    const { data: dealers } = useQuery({ queryKey: ['dealers-all'], queryFn: async () => (await api.get('/wholesaler/dealers?limit=100')).data.data.items });
    const { data: products } = useQuery({ queryKey: ['ws-products', search], queryFn: async () => (await api.get(`/wholesaler/products?limit=50&search=${encodeURIComponent(search)}`)).data.data.items });

    const flashMsg = useCallback((m: string) => { setFlash(m); setTimeout(() => setFlash(''), 1800); }, []);

    const add = useCallback((p: any) => setCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c.map((r) => r.productId === p._id ? { ...r, qty: r.qty + 10 } : r); return [...c, { productId: p._id, name: p.name, price: p.wholesalePrice || p.sellPrice, qty: 10 }]; }), []);
    const setQty = (id: string, d: number) => setCart((c) => c.map((r) => r.productId === id ? { ...r, qty: Math.max(1, r.qty + d) } : r));
    const total = useMemo(() => cart.reduce((s, r) => s + r.price * r.qty, 0), [cart]);
    const inCart = useMemo(() => new Map(cart.map((r) => [r.productId, r.qty])), [cart]);

    const scanAdd = useCallback(async (code: string) => {
        const local = (products || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`/wholesaler/products?barcode=${encodeURIComponent(code)}`)).data.data.items[0];
        if (!target) { flashMsg(`No product for ${code}`); return; }
        add(target); flashMsg(`Added ${target.name}`);
    }, [products, add, flashMsg]);
    useWedgeScanner(scanAdd, creating);

    const create = useMutation({
        mutationFn: async () => (await api.post('/wholesaler/orders', { dealerId, source, items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })) })).data.data,
        onSuccess: (order) => { setCreating(false); setDone(order); setCart([]); setDealerId(''); setError(''); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
        onError: (e) => setError(apiErr(e)),
    });

    const dealerOf = (o: any) => (dealers || []).find((d: any) => d._id === (o.dealerId?._id || o.dealerId) || d.name === o.dealerName);
    const shareOrder = (o: any) => {
        const d = dealerOf(o);
        if (!d?.mobile) { alert('No mobile number on file for this dealer. Add one on the Dealers page to send on WhatsApp.'); return; }
        window.open(whatsappLink(d.mobile, buildOrderText(o, biz), d.countryCode || '+91'), '_blank');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Orders</h1>
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile(`whoply-orders-${statusFilter}.csv`, ordersToCsv(orders || []))} disabled={!(orders || []).length}><Download size={16} /> CSV</button>
                    <button className="wp-btn wp-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New Order</button>
                </div>
            </div>

            {/* status filter — boxes (like Dispatch) */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {FILTERS.map((f) => {
                    const on = statusFilter === f;
                    return (
                        <button key={f} onClick={() => setStatusFilter(f)} className="wp-card p-3 text-center transition-all"
                            style={on ? { borderColor: 'var(--brand-600)', boxShadow: '0 0 0 1px var(--brand-600)' } : {}}>
                            <p className="text-lg font-extrabold tabular leading-none" style={{ color: 'var(--text-primary)' }}>{counts[f] || 0}</p>
                            <p className="text-[11px] sm:text-xs mt-1 capitalize truncate" style={{ color: on ? 'var(--brand-700)' : 'var(--text-secondary)' }}>{f === 'all' ? 'All' : f}</p>
                        </button>
                    );
                })}
            </div>

            {/* single-column compact rows */}
            {(orders || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>No orders.</p>}
            <div className="space-y-2">
                {(orders || []).map((o: any) => (
                    <button key={o._id} onClick={() => setDetail(o)} className="wp-card wp-card-hover p-3.5 w-full flex items-center gap-3 text-left">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</p>
                                <span className="wp-chip capitalize shrink-0" style={statusTone[o.status]}>{o.status}</span>
                            </div>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.dealerName} · {o.source} · {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</p>
                            {o.dueAmount > 0 && <p className="text-xs tabular" style={{ color: 'var(--accent-600)' }}>due {inr2(o.dueAmount)}</p>}
                        </div>
                    </button>
                ))}
            </div>

            {/* Order detail */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.orderNo || 'Order'}
                footer={detail && (
                    <div className="flex gap-2">
                        <button className="wp-btn wp-btn-ghost flex-1" onClick={() => shareOrder(detail)}><MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp</button>
                        <button className="wp-btn wp-btn-primary flex-1" onClick={() => printOrder(detail)}><Printer size={16} /> Print / PDF</button>
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.dealerName}</span>
                            <span className="wp-chip capitalize" style={statusTone[detail.status]}>{detail.source} · {detail.status}</span>
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
                            <div className="flex justify-between text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}><span>Total</span><span className="tabular">{inr2(detail.total)}</span></div>
                            <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}><span>Paid</span><span className="tabular">{inr2(detail.paidAmount)}</span></div>
                            {detail.dueAmount > 0 && <div className="flex justify-between font-semibold" style={{ color: 'var(--accent-600)' }}><span>Outstanding</span><span className="tabular">{inr2(detail.dueAmount)}</span></div>}
                            {detail.deliveredAt && <p className="text-xs pt-1" style={{ color: 'var(--success-600)' }}>Delivered {new Date(detail.deliveredAt).toLocaleDateString('en-IN')}</p>}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create order */}
            <AnimatePresence>
                {creating && (
                    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setCreating(false)}>
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto wp-scroll" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>New bulk order</h3>
                                <button onClick={() => setCreating(false)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2 mb-3">
                                <select className="wp-input" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                                    <option value="">Select dealer…</option>
                                    {(dealers || []).map((d: any) => <option key={d._id} value={d._id}>{d.name} ({{ A: 'Premium', B: 'Standard', C: 'Basic' }[d.tier as 'A' | 'B' | 'C']})</option>)}
                                </select>
                                <select className="wp-input capitalize" value={source} onChange={(e) => setSource(e.target.value)}>
                                    {['manual', 'whatsapp', 'phone', 'field'].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input className="wp-input pl-9" placeholder="Search name, barcode or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
                                </div>
                                <ScanButton onScan={scanAdd} label="Scan" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto wp-scroll mb-3">
                                {(products || []).map((p: any) => {
                                    const qty = inCart.get(p._id) || 0;
                                    return (
                                        <div key={p._id} className="wp-card p-2 relative" style={qty ? { borderColor: 'var(--brand-600)' } : {}}>
                                            {qty > 0 && <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 grid place-items-center rounded-full text-[10px] font-bold z-10" style={{ background: 'var(--brand-700)', color: '#fff' }}>{qty}</span>}
                                            <button onClick={() => add(p)} className="text-left w-full">
                                                <p className="text-xs font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                                <p className="text-xs" style={{ color: 'var(--brand-700)' }}>{inr2(p.wholesalePrice || p.sellPrice)}</p>
                                            </button>
                                            {qty > 0 && (
                                                <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--card-border)' }}>
                                                    <button onClick={() => setQty(p._id, -10)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--surface-2)' }}><Minus size={12} /></button>
                                                    <span className="text-xs font-bold tabular">{qty}</span>
                                                    <button onClick={() => setQty(p._id, 10)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--brand-700)', color: '#fff' }}><Plus size={12} /></button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="space-y-1.5 mb-3">
                                {cart.map((r) => (
                                    <div key={r.productId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                                        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                                        <button onClick={() => setQty(r.productId, -10)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Minus size={12} /></button>
                                        <span className="w-8 text-center text-sm tabular font-semibold">{r.qty}</span>
                                        <button onClick={() => setQty(r.productId, 10)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--card-bg)' }}><Plus size={12} /></button>
                                        <span className="w-20 text-right text-sm tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(r.price * r.qty)}</span>
                                        <button onClick={() => setCart((c) => c.filter((x) => x.productId !== r.productId))}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Total</span>
                                <span className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(total)}</span>
                            </div>
                            {error && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                            <button className="wp-btn wp-btn-primary w-full" disabled={!dealerId || !cart.length || create.isPending} onClick={() => create.mutate()}><Check size={16} /> Create order · {inr2(total)}</button>
                            <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Prices auto-apply the dealer’s tier price-list on save.</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* scan flash */}
            <AnimatePresence>
                {flash && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 wp-card px-4 py-2 z-[70] text-sm font-semibold" style={{ boxShadow: 'var(--shadow-lg)', color: 'var(--text-primary)' }}>{flash}</motion.div>
                )}
            </AnimatePresence>

            {/* success — send invoice to dealer on WhatsApp */}
            <AnimatePresence>
                {done && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 wp-card p-4 z-[55] w-[92vw] max-w-md" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 grid place-items-center rounded-full shrink-0" style={{ background: 'var(--success-500)', color: '#fff' }}><Check size={18} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Order created · {done.orderNo}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{inr2(done.total)} · {done.dealerName}</p>
                            </div>
                            <button onClick={() => setDone(null)}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button className="wp-btn wp-btn-ghost flex-1 !py-2 text-sm" onClick={() => shareOrder(done)}><MessageCircle size={15} style={{ color: 'var(--success-600)' }} /> Send invoice on WhatsApp</button>
                            <button className="wp-btn wp-btn-ghost flex-1 !py-2 text-sm" onClick={() => printOrder(done)}><Printer size={15} /> Print / PDF</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
