'use client';
import { useState } from 'react';
import { inr2 } from '@/lib/cn';
import { round2 } from '@/lib/tax';
import { useT } from '@/i18n';

/**
 * "How was it paid?" — cash, UPI, card, split across them, or credit (udhar).
 * The same choice as the billing screen, for other places that make a bill
 * (e.g. converting an estimate). `body` is what the API's resolvePayments takes.
 */
export type PayChoiceMode = 'cash' | 'upi' | 'card' | 'split' | 'credit';
const SPLIT_MODES = ['cash', 'upi', 'card'] as const;
type SplitMode = (typeof SPLIT_MODES)[number];
const NO_SPLIT: Record<SplitMode, string> = { cash: '', upi: '', card: '' };

export function usePaymentChoice(total: number) {
    const [mode, setMode] = useState<PayChoiceMode>('cash');
    const [split, setSplit] = useState<Record<SplitMode, string>>(NO_SPLIT);
    const paid = round2(SPLIT_MODES.reduce((s, m) => s + (Number(split[m]) || 0), 0));
    const rest = round2(total - paid);
    const over = mode === 'split' && rest < -0.005;
    const onUdhar = mode === 'credit' || (mode === 'split' && rest > 0.005);
    const body = mode === 'split'
        ? { payments: SPLIT_MODES.map((m) => ({ mode: m, amount: Number(split[m]) || 0 })).filter((p) => p.amount > 0) }
        : { paymentMode: mode };
    const reset = () => { setMode('cash'); setSplit(NO_SPLIT); };
    return { total, mode, setMode, split, setSplit, paid, rest, over, onUdhar, body, reset };
}

export function PaymentChoice({ pay }: { pay: ReturnType<typeof usePaymentChoice> }) {
    const t = useT();
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-5 gap-1.5">
                {(['cash', 'upi', 'card', 'split', 'credit'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => pay.setMode(m)} aria-pressed={pay.mode === m} className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                        style={pay.mode === m ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{m === 'split' ? t('splitPay') : m}</button>
                ))}
            </div>
            {pay.mode === 'split' && (
                <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('splitHint')}</p>
                    {SPLIT_MODES.map((m) => (
                        <div key={m} className="flex items-center gap-2">
                            <label htmlFor={`pc-split-${m}`} className="w-12 text-xs font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>{m}</label>
                            <input id={`pc-split-${m}`} className="wp-input !py-1.5 text-sm tabular flex-1" type="number" inputMode="decimal" min="0" placeholder="0"
                                value={pay.split[m]} onChange={(e) => pay.setSplit((s) => ({ ...s, [m]: e.target.value }))} />
                            <button type="button" className="text-xs font-semibold px-2.5 py-1.5 rounded-md shrink-0 disabled:opacity-40" style={{ background: 'var(--card-bg)', color: 'var(--brand-text)' }}
                                disabled={pay.rest <= 0.005} onClick={() => pay.setSplit((s) => ({ ...s, [m]: String(round2((Number(s[m]) || 0) + pay.rest)) }))}>{t('payRest')}</button>
                        </div>
                    ))}
                    <p className="text-xs font-semibold" style={{ color: pay.over ? 'var(--danger)' : pay.rest > 0.005 ? 'var(--warning)' : 'var(--success)' }}>
                        {pay.over ? t('overBill') : pay.rest > 0.005 ? `${inr2(pay.rest)} ${t('onUdhar')}` : `✓ ${inr2(pay.paid)}`}
                    </p>
                </div>
            )}
        </div>
    );
}
