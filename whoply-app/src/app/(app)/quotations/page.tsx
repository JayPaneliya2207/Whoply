'use client';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, Check, X, Search, FileText, Printer, MessageCircle, ArrowRightCircle } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ScanButton, useWedgeScanner } from '@/components/BarcodeScanner';
import { printQuote, buildQuoteText, whatsappLink } from '@/lib/bill';
import { GSTIN_PLACEHOLDER, isValidGstin } from '@/lib/gstin';

const statusTone: Record<string, any> = {
    open: { background: 'var(--brand-100)', color: 'var(--brand-800)' },
    converted: { background: '#dcfce7', color: 'var(--success-600)' },
};

export default function QuotationsPage() {
    const { user } = useAuth();
    return user?.business?.type === 'wholesale' ? <WholesaleQuotes /> : <RetailQuotes />;
}

function RetailQuotes() {
    const qc = useQueryClient();
    const { user } = useAuth();
    const t = useT();
    const biz = user?.business ? { name: user.business.name, gstin: user.business.gstin } : undefined;

    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [cust, setCust] = useState({ name: '', mobile: '', gstin: '' });
    const [disc, setDisc] = useState('');
    const [error, setError] = useState('');
    const [detail, setDetail] = useState<any>(null);
    const [del, setDel] = useState<any>(null);

    const { data: quotes } = useQuery({ queryKey: ['quotations'], queryFn: async () => (await api.get('/shopkeeper/quotations?limit=100')).data.data.items });
    const { data: products } = useQuery({ queryKey: ['q-products', search], queryFn: async () => (await api.get(`/shopkeeper/products?limit=40&search=${encodeURIComponent(search)}`)).data.data.items });

    const add = (p: any) => setCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c.map((r) => r.productId === p._id ? { ...r, qty: r.qty + 1 } : r); return [...c, { productId: p._id, name: p.name, price: p.sellPrice, qty: 1 }]; });
    const setQty = (id: string, d: number) => setCart((c) => c.map((r) => r.productId === id ? { ...r, qty: Math.max(1, r.qty + d) } : r));
    const inCart = useMemo(() => new Map(cart.map((r) => [r.productId, r.qty])), [cart]);
    const total = useMemo(() => Math.max(0, cart.reduce((s, r) => s + r.price * r.qty, 0) - (Number(disc) || 0)), [cart, disc]);

    // Barcode scan (camera / USB wedge) — add the matching product to the quote cart.
    const scanAdd = useCallback(async (code: string) => {
        const local = (products || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`/shopkeeper/products?barcode=${encodeURIComponent(code)}`)).data.data.items?.[0];
        if (!target) { setError(`${t('noProductForCode')} ${code}`); return; }
        setError(''); add(target);
    }, [products, add, t]);
    useWedgeScanner(scanAdd, creating);

    const reset = () => { setCart([]); setCust({ name: '', mobile: '', gstin: '' }); setDisc(''); setError(''); };
    const save = useMutation({
        mutationFn: async () => (await api.post('/shopkeeper/quotations', {
            items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })),
            discount: Number(disc) || 0, walkInName: cust.name || undefined, walkInMobile: cust.mobile || undefined, customerGstin: cust.gstin || undefined,
        })).data.data,
        onSuccess: () => { setCreating(false); reset(); qc.invalidateQueries({ queryKey: ['quotations'] }); },
        onError: (e) => setError(apiErr(e)),
    });
    const convert = useMutation({
        mutationFn: async (id: string) => (await api.post(`/shopkeeper/quotations/${id}/convert`, { paymentMode: 'cash' })).data.data,
        onSuccess: () => { setDetail(null); qc.invalidateQueries({ queryKey: ['quotations'] }); qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
        onError: (e) => alert(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/shopkeeper/quotations/${del._id}`)).data,
        onSuccess: () => { setDel(null); setDetail(null); qc.invalidateQueries({ queryKey: ['quotations'] }); },
    });

    const shareQuote = (q: any) => {
        if (!q.customerMobile) { alert(t('noMobileQuote')); return; }
        window.open(whatsappLink(q.customerMobile, buildQuoteText(q, biz), '+91'), '_blank');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('quotations')}</h1>
                <button className="wp-btn wp-btn-primary" onClick={() => { reset(); setCreating(true); }}><Plus size={16} /> {t('newQuote')}</button>
            </div>

            {(quotes || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noQuotes')}</p>}
            <div className="space-y-2">
                {(quotes || []).map((q: any) => (
                    <button key={q._id} onClick={() => setDetail(q)} className="wp-card wp-card-hover p-3.5 w-full flex items-center gap-3 text-left">
                        <div className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--brand-700)' }}><FileText size={16} /></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{q.quoteNo}</p>
                                <span className="wp-chip capitalize shrink-0" style={statusTone[q.status]}>{t(q.status === 'converted' ? 'converted' : 'openQuote')}</span>
                            </div>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.customerName || t('walkIn')} · {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{q.convertedInvoiceNo ? ` → ${q.convertedInvoiceNo}` : ''}</p>
                        </div>
                        <p className="font-bold tabular shrink-0" style={{ color: 'var(--text-primary)' }}>{inr2(q.grandTotal)}</p>
                    </button>
                ))}
            </div>

            {/* Quote detail */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.quoteNo || 'Quote'}
                footer={detail && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {detail.status === 'open' && <button className="wp-btn wp-btn-primary w-full sm:flex-1" disabled={convert.isPending} onClick={() => convert.mutate(detail._id)}><ArrowRightCircle size={16} /> {t('convertToBill')}</button>}
                        <button className="wp-btn wp-btn-ghost w-full sm:flex-1" onClick={() => shareQuote(detail)}><MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp</button>
                        <button className="wp-btn wp-btn-ghost w-full sm:flex-1" onClick={() => printQuote(detail, biz)}><Printer size={16} /> {t('printPdf')}</button>
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.customerName || t('walkIn')}{detail.customerMobile ? ` · ${detail.customerMobile}` : ''}</span>
                            <span className="wp-chip capitalize" style={statusTone[detail.status]}>{t(detail.status === 'converted' ? 'converted' : 'openQuote')}</span>
                        </div>
                        {detail.convertedInvoiceNo && <p className="text-xs" style={{ color: 'var(--success-600)' }}>✓ {t('convertedTo')} {detail.convertedInvoiceNo}</p>}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                            {detail.items.map((it: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{it.name} <span style={{ color: 'var(--text-muted)' }}>× {it.quantity}</span></span>
                                    <span className="tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(it.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}><span>{t('estimatedTotal')}</span><span className="tabular">{inr2(detail.grandTotal)}</span></div>
                        <button className="text-sm flex items-center gap-1.5" style={{ color: 'var(--danger-500)' }} onClick={() => setDel(detail)}><Trash2 size={14} /> {t('delete')}</button>
                    </div>
                )}
            </Modal>

            {/* Create quote */}
            <AnimatePresence>
                {creating && (
                    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setCreating(false)}>
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto wp-scroll" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{t('newQuote')}</h3>
                                <button onClick={() => setCreating(false)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                                <input className="wp-input text-sm" placeholder={t('customerNamePh')} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                                <input className="wp-input text-sm" inputMode="numeric" placeholder={t('mobileFewDigits')} value={cust.mobile} onChange={(e) => setCust({ ...cust, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                                <input className="wp-input text-sm uppercase" placeholder={GSTIN_PLACEHOLDER} maxLength={15} value={cust.gstin} onChange={(e) => setCust({ ...cust, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) })} />
                            </div>
                            {cust.gstin.length === 15 && !isValidGstin(cust.gstin) && <p className="text-xs mb-2" style={{ color: 'var(--danger-500)' }}>{t('gstinInvalid')}</p>}
                            <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input className="wp-input pl-9 w-full" placeholder={t('searchProducts')} value={search} onChange={(e) => setSearch(e.target.value)} />
                                </div>
                                <ScanButton onScan={scanAdd} label={t('scan')} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto wp-scroll mb-3">
                                {(products || []).map((p: any) => {
                                    const qty = inCart.get(p._id) || 0;
                                    return (
                                        <div key={p._id} className="wp-card p-2 relative" style={qty ? { borderColor: 'var(--brand-600)' } : {}}>
                                            {qty > 0 && <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 grid place-items-center rounded-full text-[10px] font-bold z-10" style={{ background: 'var(--brand-700)', color: '#fff' }}>{qty}</span>}
                                            <button onClick={() => add(p)} className="text-left w-full">
                                                <p className="text-xs font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                                <p className="text-xs" style={{ color: 'var(--brand-700)' }}>{inr2(p.sellPrice)}</p>
                                            </button>
                                            {qty > 0 && (
                                                <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--card-border)' }}>
                                                    <button onClick={() => setQty(p._id, -1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--surface-2)' }}><Minus size={12} /></button>
                                                    <span className="text-xs font-bold tabular">{qty}</span>
                                                    <button onClick={() => setQty(p._id, 1)} className="h-6 w-6 grid place-items-center rounded" style={{ background: 'var(--brand-700)', color: '#fff' }}><Plus size={12} /></button>
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
                                        <span className="text-sm tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(r.price * r.qty)}</span>
                                        <button onClick={() => setCart((c) => c.filter((x) => x.productId !== r.productId))}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('discountRs')}</span>
                                <input className="wp-input !py-1.5 w-24 text-sm tabular" type="number" placeholder="0" value={disc} onChange={(e) => setDisc(e.target.value)} />
                                <span className="ml-auto font-bold" style={{ color: 'var(--text-primary)' }}>{t('estimatedTotal')}: <span className="tabular">{inr2(total)}</span></span>
                            </div>
                            {error && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                            <button className="wp-btn wp-btn-primary w-full" disabled={!cart.length || save.isPending} onClick={() => save.mutate()}><Check size={16} /> {t('saveQuote')} · {inr2(total)}</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('deleteQuoteTitle')} message={`${del?.quoteNo}?`} />
        </div>
    );
}

/* ───────────────────────── Wholesaler — dealer quotes → convert to order ───────────────────────── */
function WholesaleQuotes() {
    const qc = useQueryClient();
    const { user } = useAuth();
    const t = useT();
    const biz = user?.business ? { name: user.business.name, gstin: user.business.gstin } : undefined;

    const [creating, setCreating] = useState(false);
    const [dealerId, setDealerId] = useState('');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [detail, setDetail] = useState<any>(null);
    const [del, setDel] = useState<any>(null);

    const { data: quotes } = useQuery({ queryKey: ['ws-quotes'], queryFn: async () => (await api.get('/wholesaler/quotations?limit=100')).data.data.items });
    const { data: dealers } = useQuery({ queryKey: ['dealers-all'], queryFn: async () => (await api.get('/wholesaler/dealers?limit=100')).data.data.items });
    const { data: products } = useQuery({ queryKey: ['ws-products', search], queryFn: async () => (await api.get(`/wholesaler/products?limit=40&search=${encodeURIComponent(search)}`)).data.data.items });

    const add = (p: any) => setCart((c) => { const ex = c.find((r) => r.productId === p._id); if (ex) return c.map((r) => r.productId === p._id ? { ...r, qty: r.qty + 10 } : r); return [...c, { productId: p._id, name: p.name, price: p.wholesalePrice || p.sellPrice, qty: 10 }]; });
    const setQty = (id: string, d: number) => setCart((c) => c.map((r) => r.productId === id ? { ...r, qty: Math.max(1, r.qty + d) } : r));
    const inCart = useMemo(() => new Map(cart.map((r) => [r.productId, r.qty])), [cart]);
    const total = useMemo(() => cart.reduce((s, r) => s + r.price * r.qty, 0), [cart]);

    // Barcode scan (camera / USB wedge) — add the matching product to the quote cart.
    const scanAdd = useCallback(async (code: string) => {
        const local = (products || []).find((p: any) => p.barcode === code || p.sku === code);
        const target = local || (await api.get(`/wholesaler/products?barcode=${encodeURIComponent(code)}`)).data.data.items?.[0];
        if (!target) { setError(`${t('noProductForCode')} ${code}`); return; }
        setError(''); add(target);
    }, [products, add, t]);
    useWedgeScanner(scanAdd, creating);

    const reset = () => { setCart([]); setDealerId(''); setError(''); };
    const save = useMutation({
        mutationFn: async () => (await api.post('/wholesaler/quotations', { dealerId, items: cart.map((r) => ({ productId: r.productId, quantity: r.qty })) })).data.data,
        onSuccess: () => { setCreating(false); reset(); qc.invalidateQueries({ queryKey: ['ws-quotes'] }); },
        onError: (e) => setError(apiErr(e)),
    });
    const convert = useMutation({
        mutationFn: async (id: string) => (await api.post(`/wholesaler/quotations/${id}/convert`, {})).data.data,
        onSuccess: () => { setDetail(null); qc.invalidateQueries({ queryKey: ['ws-quotes'] }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
        onError: (e) => alert(apiErr(e)),
    });
    const doDelete = useMutation({ mutationFn: async () => (await api.delete(`/wholesaler/quotations/${del._id}`)).data, onSuccess: () => { setDel(null); setDetail(null); qc.invalidateQueries({ queryKey: ['ws-quotes'] }); } });

    const shareQuote = (q: any) => { if (!q.customerMobile) { alert(t('noMobileQuote')); return; } window.open(whatsappLink(q.customerMobile, buildQuoteText(q, biz), '+91'), '_blank'); };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('quotations')}</h1>
                <button className="wp-btn wp-btn-primary" onClick={() => { reset(); setCreating(true); }}><Plus size={16} /> {t('newQuote')}</button>
            </div>

            {(quotes || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noQuotes')}</p>}
            <div className="space-y-2">
                {(quotes || []).map((q: any) => (
                    <button key={q._id} onClick={() => setDetail(q)} className="wp-card wp-card-hover p-3.5 w-full flex items-center gap-3 text-left">
                        <div className="h-9 w-9 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--brand-700)' }}><FileText size={16} /></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{q.quoteNo}</p>
                                <span className="wp-chip capitalize shrink-0" style={q.status === 'converted' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{t(q.status === 'converted' ? 'converted' : 'openQuote')}</span>
                            </div>
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.customerName} · {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{q.convertedInvoiceNo ? ` → ${q.convertedInvoiceNo}` : ''}</p>
                        </div>
                        <p className="font-bold tabular shrink-0" style={{ color: 'var(--text-primary)' }}>{inr2(q.grandTotal)}</p>
                    </button>
                ))}
            </div>

            <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.quoteNo || 'Quote'}
                footer={detail && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {detail.status === 'open' && <button className="wp-btn wp-btn-primary w-full sm:flex-1" disabled={convert.isPending} onClick={() => convert.mutate(detail._id)}><ArrowRightCircle size={16} /> {t('convertToOrder')}</button>}
                        <button className="wp-btn wp-btn-ghost w-full sm:flex-1" onClick={() => shareQuote(detail)}><MessageCircle size={16} style={{ color: 'var(--success-600)' }} /> WhatsApp</button>
                        <button className="wp-btn wp-btn-ghost w-full sm:flex-1" onClick={() => printQuote(detail, biz)}><Printer size={16} /> {t('printPdf')}</button>
                    </div>
                )}>
                {detail && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>{detail.customerName}{detail.customerGstin ? ` · ${detail.customerGstin}` : ''}</span>
                            <span className="wp-chip capitalize" style={detail.status === 'converted' ? { background: '#dcfce7', color: 'var(--success-600)' } : { background: 'var(--brand-100)', color: 'var(--brand-800)' }}>{t(detail.status === 'converted' ? 'converted' : 'openQuote')}</span>
                        </div>
                        {detail.convertedInvoiceNo && <p className="text-xs" style={{ color: 'var(--success-600)' }}>✓ {t('convertedTo')} {detail.convertedInvoiceNo}</p>}
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
                            <div className="flex justify-between text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}><span>{t('estimatedTotal')}</span><span className="tabular">{inr2(detail.grandTotal)}</span></div>
                        </div>
                        <button className="text-sm flex items-center gap-1.5" style={{ color: 'var(--danger-500)' }} onClick={() => setDel(detail)}><Trash2 size={14} /> {t('delete')}</button>
                    </div>
                )}
            </Modal>

            <AnimatePresence>
                {creating && (
                    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setCreating(false)}>
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="wp-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto wp-scroll" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{t('newQuote')}</h3>
                                <button onClick={() => setCreating(false)}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
                            </div>
                            <select className="wp-input mb-3" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                                <option value="">{t('selectDealer')}</option>
                                {(dealers || []).map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                            <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input className="wp-input pl-9 w-full" placeholder={t('searchProducts')} value={search} onChange={(e) => setSearch(e.target.value)} />
                                </div>
                                <ScanButton onScan={scanAdd} label={t('scan')} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto wp-scroll mb-3">
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
                                        <span className="text-sm tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(r.price * r.qty)}</span>
                                        <button onClick={() => setCart((c) => c.filter((x) => x.productId !== r.productId))}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('subtotal')} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(+GST)</span></span>
                                <span className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(total)}</span>
                            </div>
                            {error && <p className="text-sm mb-2" style={{ color: 'var(--danger-500)' }}>{error}</p>}
                            <button className="wp-btn wp-btn-primary w-full" disabled={!dealerId || !cart.length || save.isPending} onClick={() => save.mutate()}><Check size={16} /> {t('saveQuote')}</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('deleteQuoteTitle')} message={`${del?.quoteNo}?`} />
        </div>
    );
}
