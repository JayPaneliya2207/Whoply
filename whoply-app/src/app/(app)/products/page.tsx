'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Pencil, Trash2, FolderPlus, Boxes } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CatIcon, catEmoji } from '@/lib/icons';
import { SearchInput } from '@/components/SearchInput';

const emptyProduct = { name: '', categoryId: '', sku: '', hsn: '', unit: 'pcs', costPrice: '', sellPrice: '', wholesalePrice: '', gstRate: '0', currentStock: '0', lowStockThreshold: '10', trackExpiry: false };

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

    const [del, setDel] = useState<any>(null);

    const { data: cats } = useQuery({ queryKey: ['categories', base], queryFn: async () => (await api.get(`${base}/categories`)).data.data });
    const { data, isLoading } = useQuery({
        queryKey: ['products-page', base, search, catFilter, lowOnly],
        queryFn: async () => (await api.get(`${base}/products?limit=200&search=${encodeURIComponent(search)}${catFilter ? `&categoryId=${catFilter}` : ''}${lowOnly ? '&lowStock=true' : ''}`)).data.data.items,
    });

    const openNew = () => { setEditing(null); setForm({ ...emptyProduct, categoryId: catFilter || (cats?.[0]?._id ?? '') }); setFormErr(''); setProdModal(true); };
    const openEdit = (p: any) => {
        setEditing(p);
        setForm({ name: p.name, categoryId: p.categoryId?._id || p.categoryId || '', sku: p.sku, hsn: p.hsn || '', unit: p.unit, costPrice: p.costPrice, sellPrice: p.sellPrice, wholesalePrice: p.wholesalePrice || '', gstRate: p.gstRate, currentStock: p.currentStock, lowStockThreshold: p.lowStockThreshold, trackExpiry: p.trackExpiry });
        setFormErr(''); setProdModal(true);
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

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto wp-scroll pb-1">
                <button onClick={() => setCatFilter('')} className="wp-chip shrink-0 px-3 py-1.5" style={!catFilter ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    <Boxes size={13} /> All
                </button>
                {(cats || []).map((c: any) => (
                    <button key={c._id} onClick={() => setCatFilter(c._id)} className="wp-chip shrink-0 px-3 py-1.5 group" style={catFilter === c._id ? { background: 'var(--brand-700)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        <span>{catEmoji(c.name)}</span> {c.name} <span className="opacity-70">({c.productCount ?? 0})</span>
                        <Pencil size={11} className="opacity-0 group-hover:opacity-70 ml-0.5" onClick={(e) => { e.stopPropagation(); setEditingCat(c); setCatName(c.name); setCatModal(true); }} />
                    </button>
                ))}
            </div>

            <div className="flex gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
                <button onClick={() => setLowOnly((v) => !v)} className="wp-btn wp-btn-ghost shrink-0" style={lowOnly ? { background: '#fef3c7', color: 'var(--accent-600)', borderColor: 'transparent' } : {}}><AlertTriangle size={15} /></button>
            </div>

            {/* Table (touch-scrolls on mobile) */}
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 640 }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                                <th className="p-3 font-medium">Product</th>
                                <th className="p-3 font-medium text-right">Cost</th>
                                <th className="p-3 font-medium text-right">Sell</th>
                                <th className="p-3 font-medium text-right">GST</th>
                                <th className="p-3 font-medium text-right">Stock</th>
                                <th className="p-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={6} className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>}
                            {!isLoading && (data || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>No products. Tap “Product” to add one.</td></tr>}
                            {(data || []).map((p: any) => {
                                const low = p.currentStock <= p.lowStockThreshold;
                                return (
                                    <tr key={p._id} style={{ borderTop: '1px solid var(--card-border)' }}>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2.5">
                                                <CatIcon name={p.categoryId?.name || p.name} size="sm" />
                                                <div><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p><p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{p.categoryId?.name || p.sku}</p></div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{inr2(p.costPrice)}</td>
                                        <td className="p-3 text-right font-semibold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(p.sellPrice)}</td>
                                        <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{p.gstRate}%</td>
                                        <td className="p-3 text-right"><span className="wp-chip tabular" style={low ? { background: '#fef3c7', color: 'var(--accent-600)' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{low && <AlertTriangle size={11} />} {p.currentStock} {p.unit}</span></td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(p)}><Pencil size={14} /></button>
                                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(p)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product modal */}
            <Modal open={prodModal} onClose={() => setProdModal(false)} title={editing ? 'Edit product' : 'Add product'}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={saveProduct.isPending || !form.name || !form.sku} onClick={() => saveProduct.mutate()}>{editing ? 'Save changes' : 'Add product'}</button>}>
                <Field label="Product name"><input className="wp-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Silk Saree" /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Category"><select className="wp-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}><option value="">—</option>{(cats || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
                    <Field label="SKU"><input className="wp-input" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SKU code" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Unit"><input className="wp-input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs / kg / box" /></Field>
                    <Field label="HSN"><input className="wp-input" value={form.hsn} onChange={(e) => set('hsn', e.target.value)} placeholder="HSN code" /></Field>
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

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title="Delete product?" message={`Remove “${del?.name}” from your catalog?`} />
        </div>
    );
}
