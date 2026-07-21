'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, IndianRupee, Download, Boxes, Receipt } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { inr } from '@/lib/cn';

type Period = 'week' | 'month' | 'quarter' | 'year';
const PERIODS: { k: Period; label: string }[] = [
    { k: 'week', label: 'Weekly' },
    { k: 'month', label: 'Monthly' },
    { k: 'quarter', label: 'Quarterly' },
    { k: 'year', label: 'Yearly' },
];

export default function ReportsPage() {
    const [period, setPeriod] = useState<Period>('month');

    const { data: summary } = useQuery({ queryKey: ['rep-summary', period], queryFn: async () => (await api.get(`/shopkeeper/reports/summary?period=${period}`)).data.data });
    const { data: sales } = useQuery({ queryKey: ['rep-sales'], queryFn: async () => (await api.get('/shopkeeper/reports/sales?days=14')).data.data });
    const { data: prod } = useQuery({ queryKey: ['rep-prod'], queryFn: async () => (await api.get('/shopkeeper/reports/products')).data.data });

    const maxSale = Math.max(1, ...(sales?.daily || []).map((d: any) => d.sales));

    const downloadCsv = async () => {
        const token = localStorage.getItem('whoply_token');
        const res = await fetch(`${API_URL}/shopkeeper/reports/export?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `whoply-invoices-${period}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const tiles = [
        { label: 'Invested in stock', value: summary?.investmentAtCost, icon: Boxes, tone: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' }, hint: 'money tied up (at cost)' },
        { label: 'Revenue', value: summary?.revenue, icon: IndianRupee, tone: { bg: '#dcfce7', fg: 'var(--success-600)' }, hint: `${summary?.orders || 0} orders` },
        { label: 'Gross profit', value: summary?.grossProfit, icon: TrendingUp, tone: { bg: '#e0e7ff', fg: 'var(--brand-700)' }, hint: 'revenue − GST − COGS' },
        { label: 'Net profit', value: summary?.netProfit, icon: TrendingUp, tone: { bg: '#dcfce7', fg: 'var(--success-600)' }, hint: 'after expenses' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports & Accounts</h1>
                <button className="wp-btn wp-btn-ghost" onClick={downloadCsv}><Download size={16} /> Export CSV</button>
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {PERIODS.map((p) => (
                    <button key={p.k} onClick={() => setPeriod(p.k)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={period === p.k ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Tally tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {tiles.map((t) => (
                    <div key={t.label} className="wp-card p-5">
                        <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: t.tone.bg, color: t.tone.fg }}><t.icon size={18} /></div>
                        <p className="mt-3 text-xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(t.value || 0)}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.hint}</p>
                    </div>
                ))}
            </div>

            {/* COGS + expenses breakdown */}
            <div className="wp-card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cost of goods sold</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.cogs || 0)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Operating expenses</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.otherExpenses || 0)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff salary ({period})</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.staffSalaryForPeriod || 0)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock value (at MRP)</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.inventoryAtSell || 0)}</p></div>
            </div>

            {/* Sales bars */}
            <div className="wp-card p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Receipt size={17} /> Sales — last 14 days</h3>
                <div className="flex items-end gap-1.5 h-44">
                    {(sales?.daily || []).map((d: any) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <div className="w-full rounded-t-md" style={{ height: `${(d.sales / maxSale) * 100}%`, background: 'var(--brand-700)', minHeight: 4 }} title={`${d.date}: ${inr(d.sales)}`} />
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d.date.slice(8)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Best sellers</h3>
                    {(prod?.best || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between py-1.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                            <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{p.qty} · {inr(p.revenue)}</span>
                        </div>
                    ))}
                </div>
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Slow movers</h3>
                    {(prod?.slow || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between py-1.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                            <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{p.stock} in stock</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
