'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ClipboardCheck, Check } from 'lucide-react';
import { Modal, Field } from '@/components/Modal';
import { api, apiErr } from '@/lib/api';
import { isLooseUnit } from '@/lib/qty';
import { useT } from '@/i18n';

type Mode = 'add' | 'remove' | 'count';
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A product's stock: its recent history for anyone who can see products, and
 * (with `canAdjust`) add / remove / set-to-a-count with a reason. The server
 * applies the change atomically (POST /products/:id/adjust-stock).
 */
export function StockSheet({ product, base, canAdjust, onClose }: { product: any | null; base: string; canAdjust: boolean; onClose: () => void }) {
    const t = useT();
    const qc = useQueryClient();
    const [mode, setMode] = useState<Mode>('add');
    const [reason, setReason] = useState<'adjustment' | 'damage'>('adjustment');
    const [qty, setQty] = useState('');
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');
    useEffect(() => { setMode('add'); setReason('adjustment'); setQty(''); setNote(''); setErr(''); }, [product?._id]);

    const { data } = useQuery({
        queryKey: ['stock-moves', product?._id],
        queryFn: async () => (await api.get(`${base}/products/${product._id}/movements`)).data.data,
        enabled: !!product,
    });
    const current = data?.product?.currentStock ?? product?.currentStock ?? 0;
    const unit = product?.unit || 'pcs';
    const loose = isLooseUnit(unit);

    const n = Number(qty);
    const valid = qty !== '' && Number.isFinite(n) && (mode === 'count' ? n >= 0 : n > 0) && (loose || Number.isInteger(n));
    const next = !valid ? null : round3(mode === 'add' ? current + n : mode === 'remove' ? current - n : n);

    const save = useMutation({
        mutationFn: async () => {
            const body = mode === 'count'
                ? { countedStock: n, reason, note: note || undefined }
                : { quantity: mode === 'add' ? n : -n, reason: mode === 'add' ? 'adjustment' : reason, note: note || undefined };
            return (await api.post(`${base}/products/${product._id}/adjust-stock`, body)).data.data;
        },
        onSuccess: () => {
            setQty(''); setNote(''); setErr('');
            qc.invalidateQueries({ queryKey: ['stock-moves', product._id] });
            qc.invalidateQueries({ queryKey: ['products-page'] });
            qc.invalidateQueries({ queryKey: ['ws-products'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (e) => setErr(apiErr(e)),
    });

    const reasonLabel: Record<string, string> = {
        sale: t('mvSale'), purchase: t('mvPurchase'), return: t('mvReturn'), damage: t('mvDamage'), adjustment: t('mvAdjustment'), opening: t('mvOpening'),
    };
    const modes: [Mode, string, any][] = [['add', t('addStock'), Plus], ['remove', t('removeStock'), Minus], ['count', t('setCount'), ClipboardCheck]];

    return (
        <Modal open={!!product} onClose={onClose} title={product?.name || ''}
            footer={canAdjust ? (
                <button className="wp-btn wp-btn-primary w-full" disabled={!valid || next == null || next < 0 || save.isPending} onClick={() => save.mutate()}>
                    <Check size={16} /> {t('saveStock')}{next != null && next >= 0 ? ` · ${next} ${unit}` : ''}
                </button>
            ) : undefined}>
            <div className="rounded-xl p-3 mb-4 flex items-baseline justify-between" style={{ background: 'var(--surface-2)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('inStockNow')}</span>
                <span className="text-2xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{current} <span className="text-sm font-semibold">{unit}</span></span>
            </div>

            {canAdjust && (
                <div className="mb-5">
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl mb-3" role="radiogroup" aria-label={t('stockTitle')} style={{ background: 'var(--surface-2)' }}>
                        {modes.map(([m, label, Icon]) => (
                            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setErr(''); }}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                                style={mode === m ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                                <Icon size={15} /> {label}
                            </button>
                        ))}
                    </div>
                    {mode !== 'add' && (
                        <Field label={t('reasonLabel')}>
                            <select className="wp-input" value={reason} onChange={(e) => setReason(e.target.value as any)}>
                                <option value="adjustment">{t('reasonCorrection')}</option>
                                {mode === 'remove' && <option value="damage">{t('mvDamage')}</option>}
                            </select>
                        </Field>
                    )}
                    <Field label={`${mode === 'add' ? t('qtyToAdd') : mode === 'remove' ? t('qtyToRemove') : t('countedStockLabel')} (${unit})`}>
                        <input className="wp-input tabular" type="number" inputMode={loose ? 'decimal' : 'numeric'} min={0} step={loose ? 0.001 : 1}
                            value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                        {qty !== '' && !valid && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{loose ? t('enterPositiveQty') : t('wholeNumberQty')}</p>}
                        {next != null && next >= 0 && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('newStockWillBe')} <b className="tabular">{next} {unit}</b></p>}
                        {next != null && next < 0 && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{t('cantRemoveMore')} {current} {unit}</p>}
                    </Field>
                    <Field label={`${t('noteWord')} (${t('optionalWord')})`}><input className="wp-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></Field>
                    {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
                </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{t('stockHistory')}</h4>
            {data && data.movements.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noMovements')}</p>}
            {(data?.movements || []).map((m: any, i: number) => (
                <div key={m._id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                    <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{reasonLabel[m.reason] || m.reason}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{m.note ? ` · ${m.note}` : ''}
                        </p>
                    </div>
                    <span className="text-sm font-bold tabular shrink-0" style={{ color: m.quantity < 0 ? 'var(--danger)' : 'var(--success)' }}>{m.quantity > 0 ? '+' : '−'}{Math.abs(m.quantity)} {unit}</span>
                </div>
            ))}
        </Modal>
    );
}
