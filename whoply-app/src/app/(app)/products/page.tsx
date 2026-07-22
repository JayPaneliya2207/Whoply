'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Pencil, Trash2, FolderPlus, Boxes, ChevronDown } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CatIcon, catEmoji } from '@/lib/icons';
import { SearchInput } from '@/components/SearchInput';
import { ScanButton } from '@/components/BarcodeScanner';

const emptyProduct = { name: '', categoryId: '', sku: '', barcode: '', hsn: '', unit: 'pcs', costPrice: '', sellPrice: '', wholesalePrice: '', gstRate: '0', currentStock: '0', lowStockThreshold: '10', trackExpiry: false };

export default function ProductsPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const base = user?.business?.type === 'wholesale' ? '/wholesaler' : '/shopkeeper';
    const isWholesale = user?.business?.type === 'wholesale';

    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [lowOnly, setLowOnly] = useState(false);

    const [prodModal, setProdModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(emptyProduct);
    const [formErr, setFormErr] = useState('');

    const [catModal, setCatModal] = useState(false);
    const [catName, setCatName] = useState('');
    const [editingCat, setEditingCat] = useState<any>(null);
    const [catPicker, setCatPicker] = useState(false);

    const [del, setDel] = useState<any>(null);

    const { data: cats } = useQuery({ queryKey: ['categories', base], queryFn: async () => (await api.get(`${base}/categories`)).data.data });
    const { data, isLoading } = useQuery({
        queryKey: ['products-page', base, search, catFilter, lowOnly],
        queryFn: async () => (await api.get(`${base}/products?limit=200&search=${encodeURIComponent(search)}${catFilter ? `&categoryId=${catFilter}` : ''}${lowOnly ? '&lowStock=true' : ''}`)).data.data.items,
    });

    const activeCat = (cats || []).find((c: any) => c._id === catFilter) || null;

    const openNew = () => { setEditing(null); setForm({ ...emptyProduct, categoryId: catFilter || (cats?.[0]?._id ?? '') }); setFormErr(''); setProdModal(true); };
    const openEdit = (p: any) => {
        setEditing(p);
        setForm({ name: p.name, categoryId: p.categoryId?._id || p.categoryId || '', sku: p.sku, barcode: p.barcode || '', hsn: p.hsn || '', unit: p.unit, costPrice: p.costPrice, sellPrice: p.sellPrice, wholesalePrice: p.wholesalePrice || '', gstRate: p.gstRate, currentStock: p.currentStock, lowStockThreshold: p.lowStockThreshold, trackExpiry: p.trackExpiry });
        setFormErr(''); setProdModal(true);
    };

    // Scan on the list: existing barcode → edit that product (top up stock); new → prefill add form.
    const scanLookup = async (code: string) => {
        const items = (await api.get(`${base}/products?barcode=${encodeURIComponent(code)}`)).data.data.items;
        if (items[0]) { openEdit(items[0]); }
        else { setEditing(null); setForm({ ...emptyProduct, barcode: code, categoryId: catFilter || (cats?.[0]?._id ?? '') }); setFormErr(''); setProdModal(true); }
    };

    const saveProduct = useMutation({
        mutationFn: async () => {
            const body: any = { ...form, costPrice: +form.costPrice || 0, sellPrice: +form.sellPrice || 0, wholesalePrice: +form.wholesalePrice || 0, gstRate: +form.gstRate || 0, currentStock: +form.currentStock || 0, lowStockThreshold: +form.lowStockThreshold || 0 };
            if (!body.categoryId) delete body.categoryId;
            if (editing) return (await api.patch(`${base}/products/${editing._id}`, body)).data.data;
            return (await api.post(`${base}/products`, body)).data.data;
        },
        onSuccess: () => { setProdModal(false); qc.invalidateQueries({ queryKey: ['products-page'] }); qc.invalidateQueries({ queryKey: ['categories'] }); },
        onError: (e) => setFormErr(apiErr(e)),
    });

    const saveCat = useMutation({
        mutationFn: async () => {
            if (editingCat) return (await api.patch(`${base}/categories/${editingCat._id}`, { name: catName })).data.data;
            return (await api.post(`${base}/categories`, { name: catName })).data.data;
        },
        onSuccess: () => { setCatModal(false); setCatName(''); setEditingCat(null); qc.invalidateQueries({ queryKey: ['categories'] }); },
    });

    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`${base}/products/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['products-page'] }); qc.invalidateQueries({ queryKey: ['categories'] }); },
    });

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{isWholesale ? 'Warehouse Stock' : 'Products & Inventory'}</h1>
                <div className="flex gap-2">
                    <button className="wp-btn wp-btn-ghost text-sm" onClick={() => { setEditingCat(null); setCatName(''); setCatModal(true); }}><FolderPlus size={15} /> Category</button>
                    <button className="wp-btn wp-btn-primary text-sm" onClick={openNew}><Plus size={16} /> Product</button>
                </div>
            </div>

            {/* Category filter — opens a popup of category boxes */}
            <div className="flex gap-2">
                <button onClick={() => setCatPicker(true)} className="wp-btn wp-btn-ghost flex-1 justify-between">
                    <span className="flex items-center gap-2 truncate">
                        {activeCat ? <><span>{catEmoji(activeCat.name)}</span> {activeCat.name}</> : <><Boxes size={15} /> All categories</>}
                    </span>
                    <ChevronDown size={16} />
                </button>
            </div>

            <div className="flex gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Search by name, barcode or SKU…" />
                <ScanButton onScan={scanLookup} label="Scan" />
                <button onClick={() => setLowOnly((v) => !v)} className="wp-btn wp-btn-ghost shrink-0" style={lowOnly ? { background: '#fef3c7', color: 'var(--accent-600)', borderColor: 'transparent' } : {}}><AlertTriangle size={15} /></button>
            </div>

            {/* One product per row — scrolls up/down only */}
            {isLoading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!isLoading && (data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>No products. Tap “Product” to add one.</p>}
            <div className="space-y-2">
                {(data || []).map((p: any) => {
                    const low = p.currentStock <= p.lowStockThreshold;
                    return (
                        <div key={p._id} className="wp-card p-3 flex items-center gap-3">
                            <CatIcon name={p.categoryId?.name || p.name} size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                <p className="text-xs capitalize truncate" style={{ color: 'var(--text-muted)' }}>{p.categoryId?.name || p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(p.sellPrice)}</p>
                                <p className="text-[11px] tabular hidden sm:block" style={{ color: 'var(--text-muted)' }}>cost {inr2(p.costPrice)} · GST {p.gstRate}%</p>
                            </div>
                            <span className="wp-chip tabular shrink-0" style={low ? { background: '#fef3c7', color: 'var(--accent-600)' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{low && <AlertTriangle size={11} />} {p.currentStock} {p.unit}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(p)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(p)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Product modal */}
            <Modal open={prodModal} onClose={() => setProdModal(false)} title={editing ? 'Edit product' : 'Add product'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={saveProduct.isPending || !form.name || !form.sku} onClick={() => saveProduct.mutate()}>{editing ? 'Save changes' : 'Add product'}</button>}>
                <Field label="Product name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Silk Saree" /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Category"><select className="wp-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}><option value="">—</option>{(cats || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
                    <Field label="SKU"><input className="wp-input" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SKU code" /></Field>
                </div>
                <Field label="Barcode">
                    <div className="flex gap-2">
                        <input className="wp-input" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Scan or type the barcode" inputMode="numeric" />
                        <ScanButton onScan={(code) => set('barcode', code)} label="" />
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Unit"><input className="wp-input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs / kg / box" /></Field>
                    <Field label="HSN code"><input className="wp-input" value={form.hsn} onChange={(e) => set('hsn', e.target.value)} placeholder="e.g. 6109 (tax code)" /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Cost ₹"><input className="wp-input tabular" type="number" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} /></Field>
                    <Field label="Sell ₹"><input className="wp-input tabular" type="number" value={form.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} /></Field>
                    <Field label="GST %"><input className="wp-input tabular" type="number" value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {isWholesale && <Field label="Wholesale ₹"><input className="wp-input tabular" type="number" value={form.wholesalePrice} onChange={(e) => set('wholesalePrice', e.target.value)} /></Field>}
                    <Field label="Stock"><input className="wp-input tabular" type="number" value={form.currentStock} onChange={(e) => set('currentStock', e.target.value)} disabled={!!editing} /></Field>
                    <Field label="Low-stock at"><input className="wp-input tabular" type="number" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} /></Field>
                </div>
                {editing && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Stock is changed via sales/purchases, not edited directly.</p>}
                {formErr && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{formErr}</p>}
            </Modal>

            {/* Category modal */}
            <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Edit category' : 'Add category'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={saveCat.isPending || !catName} onClick={() => saveCat.mutate()}>{editingCat ? 'Save' : 'Add category'}</button>}>
                <Field label="Category name"><input className="wp-input" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Groceries" autoFocus /></Field>
            </Modal>

            {/* Category picker — boxes, gesture-dismiss */}
            <Modal open={catPicker} onClose={() => setCatPicker(false)} title="Categories"
                footer={<button className="wp-btn wp-btn-ghost w-full" onClick={() => { setCatPicker(false); setEditingCat(null); setCatName(''); setCatModal(true); }}><FolderPlus size={15} /> Add category</button>}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button onClick={() => { setCatFilter(''); setCatPicker(false); }} className="wp-card p-3 text-center"
                        style={!catFilter ? { borderColor: 'var(--brand-600)', boxShadow: '0 0 0 1px var(--brand-600)' } : {}}>
                        <Boxes size={20} className="mx-auto mb-1" style={{ color: 'var(--brand-700)' }} />
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>All</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(cats || []).reduce((s: number, c: any) => s + (c.productCount ?? 0), 0)} items</p>
                    </button>
                    {(cats || []).map((c: any) => (
                        <div key={c._id} className="wp-card p-3 text-center relative" style={catFilter === c._id ? { borderColor: 'var(--brand-600)', boxShadow: '0 0 0 1px var(--brand-600)' } : {}}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingCat(c); setCatName(c.name); setCatPicker(false); setCatModal(true); }} className="absolute top-1.5 right-1.5 opacity-60"><Pencil size={12} /></button>
                            <button onClick={() => { setCatFilter(c._id); setCatPicker(false); }} className="w-full">
                                <span className="text-2xl block leading-none mb-1">{catEmoji(c.name)}</span>
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.productCount ?? 0} items</p>
                            </button>
                        </div>
                    ))}
                </div>
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title="Delete product?" message={`Remove “${del?.name}” from your catalog?`} />
        </div>
    );
}
