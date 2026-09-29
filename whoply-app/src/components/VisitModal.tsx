'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Modal, Field } from '@/components/Modal';
import { api, apiErr } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { useT } from '@/i18n';

export const OUTCOMES = ['order', 'no_order', 'follow_up'] as const;
export const outcomeKey: Record<string, string> = { order: 'visitOrder', no_order: 'visitNoOrder', follow_up: 'visitFollowUp' };
export const outcomeTone: Record<string, any> = {
    order: { background: 'var(--success-tint)', color: 'var(--success)' },
    no_order: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    follow_up: { background: 'var(--warning-tint)', color: 'var(--warning)' },
};

/**
 * Log a field visit to a dealer. A sales rep logs their own; the owner /
 * manager (team.view) picks which rep went. Pass `dealer` to fix the dealer,
 * or leave it out to choose one.
 */
export function VisitModal({ open, dealer, onClose }: { open: boolean; dealer?: any; onClose: () => void }) {
    const t = useT();
    const can = useCan();
    const qc = useQueryClient();
    const pickRep = can('team.view');
    const [dealerId, setDealerId] = useState('');
    const [repId, setRepId] = useState('');
    const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('no_order');
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');

    const { data: dealers } = useQuery({
        queryKey: ['dealers-all'],
        queryFn: async () => (await api.get('/wholesaler/dealers?limit=100')).data.data.items,
        enabled: open && !dealer,
    });
    const { data: reps } = useQuery({ queryKey: ['reps'], queryFn: async () => (await api.get('/wholesaler/sales-team')).data.data, enabled: open && pickRep });

    useEffect(() => {
        if (!open) return;
        setDealerId(dealer?._id || ''); setOutcome('no_order'); setNote(''); setErr('');
        setRepId(dealer?.assignedRepId ? String(dealer.assignedRepId) : '');
    }, [open, dealer]);

    const save = useMutation({
        mutationFn: async () => (await api.post('/wholesaler/sales-team/visits', { dealerId, outcome, note: note || undefined, ...(pickRep && { salesRepId: repId }) })).data.data,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['visits'] }); qc.invalidateQueries({ queryKey: ['reps'] }); onClose(); },
        onError: (e) => setErr(apiErr(e)),
    });

    return (
        <Modal open={open} onClose={onClose} title={dealer ? `${t('logVisit')} · ${dealer.name}` : t('logVisit')}
            footer={<button className="wp-btn wp-btn-primary w-full" disabled={!dealerId || (pickRep && !repId) || save.isPending} onClick={() => save.mutate()}><Check size={16} /> {t('saveVisit')}</button>}>
            {!dealer && (
                <Field label={t('dealerNameLabel')}>
                    <select className="wp-input" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                        <option value="">{t('selectDealer')}</option>
                        {(dealers || []).map((d: any) => <option key={d._id} value={d._id}>{d.name}{d.city ? ` · ${d.city}` : ''}</option>)}
                    </select>
                </Field>
            )}
            {pickRep && (
                <Field label={t('salesRepLabel')}>
                    <select className="wp-input" value={repId} onChange={(e) => setRepId(e.target.value)}>
                        <option value="">{t('selectRep')}</option>
                        {(reps || []).map((r: any) => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                    {reps && !reps.length && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('noRepsYet')}</p>}
                </Field>
            )}
            <Field label={t('visitOutcome')}>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" role="radiogroup" aria-label={t('visitOutcome')} style={{ background: 'var(--surface-2)' }}>
                    {OUTCOMES.map((o) => (
                        <button key={o} type="button" role="radio" aria-checked={outcome === o} onClick={() => setOutcome(o)}
                            className="py-2 rounded-lg text-sm font-semibold transition-colors"
                            style={outcome === o ? { background: 'var(--card-bg)', color: 'var(--brand-text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                            {t(outcomeKey[o])}
                        </button>
                    ))}
                </div>
            </Field>
            <Field label={`${t('noteWord')} (${t('optionalWord')})`}>
                <input className="wp-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('visitNotePh')} />
            </Field>
            {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
        </Modal>
    );
}
