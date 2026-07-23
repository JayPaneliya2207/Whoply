'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { Modal, Field } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useT } from '@/i18n';

const CATS = ['rent', 'electricity', 'salary', 'transport', 'supplies', 'marketing', 'other'];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const empty = { category: 'rent', amount: '', note: '', spentAt: '' };

export default function ExpensesPage() {
    const qc = useQueryClient();
    const t = useT();
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(empty);
    const [err, setErr] = useState('');
    const [del, setDel] = useState<any>(null);

    const { data } = useQuery({ queryKey: ['expenses'], queryFn: async () => (await api.get('/shopkeeper/expenses?limit=100')).data.data.items });

    const openNew = () => { setEditing(null); setForm({ ...empty, spentAt: todayStr() }); setErr(''); setModal(true); };
    const openEdit = (e: any) => { setEditing(e); setForm({ category: e.category, amount: e.amount, note: e.note || '', spentAt: e.spentAt?.slice(0, 10) || '' }); setErr(''); setModal(true); };

    const save = useMutation({
        mutationFn: async () => {
            const body = { category: form.category, amount: Number(form.amount), note: form.note, ...(form.spentAt && { spentAt: form.spentAt }) };
            if (editing) return (await api.patch(`/shopkeeper/expenses/${editing._id}`, body)).data.data;
            return (await api.post('/shopkeeper/expenses', body)).data.data;
        },
        onSuccess: () => { setModal(false); qc.invalidateQueries({ queryKey: ['expenses'] }); },
        onError: (e) => setErr(apiErr(e)),
    });
    const doDelete = useMutation({
        mutationFn: async () => (await api.delete(`/shopkeeper/expenses/${del._id}`)).data,
        onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['expenses'] }); },
    });

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const monthTotal = (data || []).reduce((s: number, e: any) => s + e.amount, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('expensesTitle')}</h1>
                <button className="wp-btn wp-btn-primary" onClick={openNew}><Plus size={16} /> {t('addExpense')}</button>
            </div>

            <div className="wp-card p-5 flex items-center gap-3">
                <div className="h-11 w-11 grid place-items-center rounded-xl" style={{ background: '#fef3c7', color: 'var(--accent-600)' }}><Wallet size={20} /></div>
                <div><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalRecent')}</p><p className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr2(monthTotal)}</p></div>
            </div>

            {(data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noExpenses')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((e: any) => (
                    <div key={e._id} className="wp-card p-4">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0">
                                <p className="capitalize font-semibold" style={{ color: 'var(--text-primary)' }}>{e.category}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(e.spentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => openEdit(e)}><Pencil size={14} /></button>
                                <button className="wp-btn wp-btn-ghost !p-2" onClick={() => setDel(e)}><Trash2 size={14} style={{ color: 'var(--danger-500)' }} /></button>
                            </div>
                        </div>
                        <p className="text-xl font-extrabold tabular mt-2" style={{ color: 'var(--text-primary)' }}>{inr2(e.amount)}</p>
                        {e.note && <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{e.note}</p>}
                    </div>
                ))}
            </div>

            <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('editExpense') : t('addExpense')}
                footer={<button className="wp-btn wp-btn-primary w-full" disabled={save.isPending || !Number(form.amount)} onClick={() => save.mutate()}>{editing ? t('save') : t('addExpense')}</button>}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('category')}><select className="wp-input capitalize" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                    <Field label={t('date')}><input className="wp-input" type="date" max={todayStr()} value={form.spentAt} onChange={(e) => set('spentAt', e.target.value)} /></Field>
                </div>
                <Field label={t('amountRs')}><input className="wp-input tabular" type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} autoFocus /></Field>
                <Field label={t('note')}><input className="wp-input" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('optionalWord')} /></Field>
                {err && <p className="text-sm" style={{ color: 'var(--danger-500)' }}>{err}</p>}
            </Modal>

            <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => doDelete.mutate()} loading={doDelete.isPending} title={t('deleteExpenseTitle')} message="This expense will be permanently removed." />
        </div>
    );
}
