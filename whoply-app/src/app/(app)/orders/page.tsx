'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, FileText, Check, X, Package, Search } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';

const statusTone: Record<string, any> = {
    pending: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    confirmed: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    dispatched: { background: '#fef3c7', color: 'var(--accent-600)' },
    delivered: { background: '#dcfce7', color: 'var(--success-600)' },
    cancelled: { background: '#fee2e2', color: 'var(--danger-500)' },
};

export default function OrdersPage() {
    const qc = useQueryClient();
    const [creating, setCreating] = useState(false);
    const [dealerId, setDealerId] = useState('');
    const [source, setSource] = useState('manual');
    const [cart, setCart] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/wholesaler/orders?limit=50')).data.data.items });
    const { data: dealers } = useQuery({ queryKey: ['dealers-all'], queryFn: async () => (await api.get('/wholesaler/dealers?limit=100')).data.data.items });
    const { data: products } = useQuery({ queryKey: ['ws-products', search], queryFn: async () => (await api.get(`/wholesaler/products?limit=50&search=${encodeURIComponent(search)}`)).data.data.items });

    const add = (p: any) => setCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c.map((r) => r.productId === p._id ? { ...r, qty: r.qty + 10 } : r); return [...c, { productId: p._id, name: p.name, price: p.wholesalePrice || p.sellPrice, qty: 10 }]; });
    const setQty = (id: string, d: number) => setCart((c) => c.map((r) => r.productId === id ? { ...r, qty: Math.max(1, r.qty + d) } : r));
    const total = useMemo(() => cart.reduce((s, r) => s + r.price * r.qty, 0), [cart]);

    const create = useMutation({
        mutationFn: async () => (await api.post('/wholesaler/orders', { dealerId, source, items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })) })).data.data,
        onSuccess: () => { setCreating(false); setCart([]); setDealerId(''); setError(''); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
        onError: (e) => setError(apiErr(e)),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Orders</h1>
                <button className="wp-btn wp-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New Order</button>
            </div>

            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                <table className="w-full text-sm" style={{ minWidth: 640 }}>
                    <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                        <th className="p-3 font-medium">Order</th><th className="p-3 font-medium">Dealer</th><th className="p-3 font-medium">Source</th>
                        <th className="p-3 font-medium text-right">Total</th><th className="p-3 font-medium text-right">Due</th><th className="p-3 font-medium text-right">Status</th>
                    </tr></thead>
                    <tbody>
                        {(orders || []).map((o: any) => (
                            <tr key={o._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{o.orderNo}</td>
                                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{o.dealerName}</td>
                                <td className="p-3 capitalize" style={{ color: 'var(--text-muted)' }}>{o.source}</td>
                                <td className="p-3 text-right tabular font-semibold" style={{ color: 'var(--text-primary)' }}>{inr2(o.total)}</td>
                                <td className="p-3 text-right tabular" style={{ color: o.dueAmount > 0 ? 'var(--accent-600)' : 'var(--text-muted)' }}>{inr2(o.dueAmount)}</td>
                                <td className="p-3 text-right"><span className="wp-chip capitalize" style={statusTone[o.status]}>{o.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

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
                            <div className="relative mb-2">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input className="wp-input pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto wp-scroll mb-3">
                                {(products || []).map((p: any) => (
                                    <button key={p._id} onClick={() => add(p)} className="wp-card p-2 text-left">
                                        <p className="text-xs font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--brand-700)' }}>{inr2(p.wholesalePrice || p.sellPrice)}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-1.5 mb-3">
                                {cart.map((r) => (
                                    <div key={r.productId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                                        <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
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
        </div>
    );
}
