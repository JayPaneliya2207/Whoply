'use client';
import { Loader2 } from 'lucide-react';
import { inr2 } from '@/lib/cn';
import { useT } from '@/i18n';
import type { useDealerPricing } from '@/lib/dealerPricing';

/**
 * Subtotal, GST and total for a dealer's cart, as the order / quotation will be
 * saved (see useDealerPricing). Before a dealer is picked there is no price
 * group yet, so it says so instead of showing a total that would change.
 */
export function PriceSummary({ pricing, dealerChosen, empty }: { pricing: ReturnType<typeof useDealerPricing>; dealerChosen: boolean; empty: boolean }) {
    const t = useT();
    if (empty) return null;
    if (!dealerChosen) return <p className="text-sm mb-3 text-center" style={{ color: 'var(--text-muted)' }}>{t('pickDealerForPrices')}</p>;
    if (pricing.error) return <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{pricing.error}</p>;
    const d = pricing.data;
    const row = (label: string, v?: number, strong = false) => (
        <div className={`flex items-center justify-between ${strong ? 'text-lg font-extrabold' : 'text-sm'}`} style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            <span>{label}</span>
            <span className="tabular">{v == null ? '…' : inr2(v)}</span>
        </div>
    );
    return (
        <div className="mb-3 space-y-1" aria-live="polite" aria-busy={pricing.loading}>
            {row(t('subtotal'), d?.subtotal)}
            {row('GST', d?.totalGst)}
            <div className="pt-1" style={{ borderTop: '1px solid var(--card-border)' }}>{row(t('total'), d?.grandTotal, true)}</div>
            {pricing.loading && <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin" /> {t('updatingPrices')}</p>}
        </div>
    );
}
