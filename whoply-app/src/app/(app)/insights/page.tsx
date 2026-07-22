'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, TrendingDown, PackagePlus, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

const urgencyTone: Record<string, any> = {
    critical: { background: '#fee2e2', color: 'var(--danger-500)' },
    soon: { background: '#fef3c7', color: 'var(--accent-600)' },
    ok: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
};

export default function InsightsPage() {
    const { data, isLoading } = useQuery({ queryKey: ['ai-reorder'], queryFn: async () => (await api.get('/shopkeeper/ai/reorder')).data.data });

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2">
                <div className="h-9 w-9 grid place-items-center rounded-xl" style={{ background: 'var(--brand-700)', color: '#fff' }}><Sparkles size={18} /></div>
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>AI Insights</h1>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Smart reorder suggestions from your sales velocity</p>
                </div>
            </div>

            {data && (
                <div className="wp-card p-4 flex items-center gap-3" style={{ background: 'var(--brand-700)', color: '#fff' }}>
                    <AlertTriangle size={20} />
                    <div>
                        <p className="font-bold">{data.critical} product(s) need urgent reordering</p>
                        <p className="text-sm text-white/80">Based on the last 30 days of sales, targeting 14 days of stock cover.</p>
                    </div>
                </div>
            )}

            {isLoading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analysing sales…</p>}
            {!isLoading && (data?.suggestions || []).length === 0 && <p className="text-sm wp-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>No reorder suggestions right now.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data?.suggestions || []).map((s: any, i: number) => (
                    <motion.div key={s.productId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="wp-card p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                            <span className="wp-chip capitalize shrink-0" style={urgencyTone[s.urgency]}>{s.urgency}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-sm font-bold tabular" style={{ color: 'var(--text-primary)' }}>{s.currentStock}</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>in stock</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-sm font-bold tabular" style={{ color: 'var(--text-secondary)' }}>{s.dailyVelocity}</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>sells/day</p>
                            </div>
                            <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)' }}>
                                <p className="text-sm font-bold tabular" style={{ color: s.daysOfCover !== null && s.daysOfCover <= 5 ? 'var(--danger-500)' : 'var(--text-primary)' }}>{s.daysOfCover === null ? '—' : `${s.daysOfCover}d`}</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>days left</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Suggested order</span>
                            {s.suggestedQty > 0
                                ? <span className="wp-chip" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}><PackagePlus size={12} /> {s.suggestedQty} {s.unit}</span>
                                : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                    </motion.div>
                ))}
            </div>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <TrendingDown size={13} /> Transparent heuristic: days-of-cover = stock ÷ daily sales. Products running out soonest are listed first.
            </p>
        </div>
    );
}
