'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Tags } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';
import { useT } from '@/i18n';

const TIERS: { key: 'A' | 'B' | 'C'; labelKey: string; hintKey: string }[] = [
    { key: 'A', labelKey: 'tierPremium', hintKey: 'bestPrice' },
    { key: 'B', labelKey: 'tierStandard', hintKey: 'regularDealers' },
    { key: 'C', labelKey: 'tierBasic', hintKey: 'smallBuyers' },
];

function PriceCell({ row, tier }: { row: any; tier: 'A' | 'B' | 'C' }) {
    const qc = useQueryClient();
    const [val, setVal] = useState<string>(row[tier] != null ? String(row[tier]) : '');
    const save = useMutation({
        mutationFn: async () => (await api.put('/wholesaler/price-lists', { productId: row.productId, tier, price: Number(val) })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['price-lists'] }),
    });
    return (
        <input
            className="wp-input !py-1.5 !px-2 text-right tabular text-sm w-full"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { if (val && Number(val) !== row[tier]) save.mutate(); }}
            placeholder={String(row.base)}
        />
    );
}

export default function PriceListsPage() {
    const t = useT();
    const { data } = useQuery({ queryKey: ['price-lists'], queryFn: async () => (await api.get('/wholesaler/price-lists')).data.data });
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Tags size={20} style={{ color: 'var(--brand-700)' }} />
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('dealerPriceLists')}</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('priceListDesc')}</p>

            {(data || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('noProductsToPrice')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data || []).map((row: any) => (
                    <div key={row.productId} className="wp-card p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
                            <span className="text-xs tabular shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{t('baseWord')} {inr2(row.base)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {TIERS.map((tr) => (
                                <div key={tr.key}>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>{t(tr.labelKey)}</label>
                                    <PriceCell row={row} tier={tr.key} />
                                    <span className="text-[10px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(tr.hintKey)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
