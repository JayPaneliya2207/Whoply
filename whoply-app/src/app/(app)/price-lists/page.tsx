'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Tags } from 'lucide-react';
import { api } from '@/lib/api';
import { inr2 } from '@/lib/cn';

function PriceCell({ row, tier }: { row: any; tier: 'A' | 'B' | 'C' }) {
    const qc = useQueryClient();
    const [val, setVal] = useState<string>(row[tier] != null ? String(row[tier]) : '');
    const save = useMutation({
        mutationFn: async () => (await api.put('/wholesaler/price-lists', { productId: row.productId, tier, price: Number(val) })).data.data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['price-lists'] }),
    });
    return (
        <input
            className="wp-input !py-1.5 !px-2 text-right tabular w-24 text-sm"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { if (val && Number(val) !== row[tier]) save.mutate(); }}
            placeholder={String(row.base)}
        />
    );
}

export default function PriceListsPage() {
    const { data } = useQuery({ queryKey: ['price-lists'], queryFn: async () => (await api.get('/wholesaler/price-lists')).data.data });
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Tags size={20} style={{ color: 'var(--brand-700)' }} />
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dealer Price Lists</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Set tier-wise pricing. Tier A (best), B, C. Blank = base price. Edits save on blur.</p>
            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: 560 }}>
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Product</th><th className="p-3 font-medium text-right">Base</th>
                            <th className="p-3 font-medium text-right">Tier A</th><th className="p-3 font-medium text-right">Tier B</th><th className="p-3 font-medium text-right">Tier C</th>
                        </tr></thead>
                        <tbody>
                            {(data || []).map((row: any) => (
                                <tr key={row.productId} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{row.name}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-muted)' }}>{inr2(row.base)}</td>
                                    <td className="p-3 text-right"><PriceCell row={row} tier="A" /></td>
                                    <td className="p-3 text-right"><PriceCell row={row} tier="B" /></td>
                                    <td className="p-3 text-right"><PriceCell row={row} tier="C" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
