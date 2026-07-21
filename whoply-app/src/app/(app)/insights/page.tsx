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

            <div className="wp-card overflow-hidden">
                <div className="overflow-x-auto wp-scroll">
                    <table className="w-full text-sm">
                        <thead><tr style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }} className="text-left">
                            <th className="p-3 font-medium">Product</th>
                            <th className="p-3 font-medium text-right">In stock</th>
                            <th className="p-3 font-medium text-right">Sells/day</th>
                            <th className="p-3 font-medium text-right">Days left</th>
                            <th className="p-3 font-medium text-right">Suggested order</th>
                            <th className="p-3 font-medium text-right">Urgency</th>
                        </tr></thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={6} className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>Analysing sales…</td></tr>}
                            {(data?.suggestions || []).map((s: any, i: number) => (
                                <motion.tr key={s.productId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{s.currentStock} {s.unit}</td>
                                    <td className="p-3 text-right tabular" style={{ color: 'var(--text-secondary)' }}>{s.dailyVelocity}</td>
                                    <td className="p-3 text-right tabular font-semibold" style={{ color: s.daysOfCover !== null && s.daysOfCover <= 5 ? 'var(--danger-500)' : 'var(--text-primary)' }}>
                                        {s.daysOfCover === null ? '—' : `${s.daysOfCover}d`}
                                    </td>
                                    <td className="p-3 text-right">
                                        {s.suggestedQty > 0 ? (
                                            <span className="wp-chip" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}><PackagePlus size={12} /> {s.suggestedQty} {s.unit}</span>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td className="p-3 text-right"><span className="wp-chip capitalize" style={urgencyTone[s.urgency]}>{s.urgency}</span></td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <TrendingDown size={13} /> Transparent heuristic: days-of-cover = stock ÷ daily sales. Products running out soonest are listed first.
            </p>
        </div>
    );
}
