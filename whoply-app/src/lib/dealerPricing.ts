'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api, apiErr } from '@/lib/api';

export interface DealerPricing {
    tier?: string;
    lines: { productId: string; quantity: number; price: number; gstRate: number; gstAmount: number; taxableValue?: number; lineTotal: number; quoted?: boolean }[];
    /** Set when the order being edited came from an estimate: its products keep the quoted price. */
    quoteNo?: string;
    subtotal: number;
    totalGst: number;
    grandTotal: number;
}

/**
 * Live prices for a dealer's cart, from POST /wholesaler/price-preview — the
 * same maths saving the order or quotation uses (the dealer's price group,
 * each product's GST). Asks 300 ms after the last change and keeps showing
 * the previous prices while the new ones load. Pass `orderId` while editing
 * an order: products from the estimate it was made from keep the quoted price.
 */
export function useDealerPricing(dealerId: string, cart: { productId: string; qty: number }[], orderId?: string) {
    const sig = JSON.stringify(cart.map((r) => [r.productId, r.qty]));
    const [asked, setAsked] = useState(sig);
    useEffect(() => { const id = setTimeout(() => setAsked(sig), 300); return () => clearTimeout(id); }, [sig]);

    const q = useQuery({
        queryKey: ['price-preview', dealerId, asked, orderId || ''],
        queryFn: async () => {
            const items = (JSON.parse(asked) as [string, number][]).map(([productId, quantity]) => ({ productId, quantity }));
            return (await api.post('/wholesaler/price-preview', { dealerId, items, ...(orderId && { orderId }) })).data.data as DealerPricing;
        },
        enabled: !!dealerId && cart.length > 0,
        placeholderData: keepPreviousData,
        retry: false,
    });

    // One cart row per product: add up its priced lines.
    const byProduct = useMemo(() => {
        const m = new Map<string, { lineTotal: number; unitPrice: number; quoted: boolean }>();
        for (const l of q.data?.lines || []) {
            const id = String(l.productId);
            const cur = m.get(id);
            m.set(id, { lineTotal: (cur?.lineTotal || 0) + l.lineTotal, unitPrice: l.price, quoted: !!l.quoted });
        }
        return m;
    }, [q.data]);

    return {
        data: dealerId && cart.length ? q.data : undefined,
        byProduct,
        loading: !!dealerId && cart.length > 0 && (q.isFetching || asked !== sig),
        error: q.error ? apiErr(q.error) : '',
    };
}
