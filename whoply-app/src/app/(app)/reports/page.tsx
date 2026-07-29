'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Download, Boxes, Wallet, Building2, ShoppingBag, MessageCircle } from 'lucide-react';
import { RupeeIcon } from '@/components/RupeeIcon';
import { api, API_URL } from '@/lib/api';
import { inr, inr2 } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';
import { useT } from '@/i18n';
import { paymentsToCsv, downloadFile, buildDealerPaymentText, whatsappLink } from '@/lib/bill';

export default function ReportsPage() {
    const { user } = useAuth();
    if (user?.business?.type === 'wholesale') return <WholesaleTally />;
    return <ShopReports />;
}

/* ───────────────────────── Wholesaler — account tally ───────────────────────── */
function WholesaleTally() {
    const t = useT();
    const [period, setPeriod] = useState<Period>('month');
    const periodLabel: Record<Period, string> = { week: t('weekly'), month: t('monthly'), quarter: t('quarterly'), year: t('yearly') };
    const { data: biz } = useQuery({ queryKey: ['ws-business'], queryFn: async () => (await api.get('/wholesaler/business')).data.data });
    const { data } = useQuery({ queryKey: ['ws-tally', period], queryFn: async () => (await api.get(`/wholesaler/reports/tally?period=${period}`)).data.data, refetchOnMount: 'always' });

    const remindDealer = (d: any) => {
        if (!d.mobile) { alert('Add a mobile number for this dealer to send a reminder.'); return; }
        window.open(whatsappLink(d.mobile, buildDealerPaymentText(d.name, d.outstanding, biz), d.countryCode || '+91'), '_blank');
    };

    const modes: [string, string][] = [['cash', t('mode_cash')], ['upi', t('mode_upi')], ['bank', t('mode_bank')], ['cheque', t('mode_cheque')], ['other', t('mode_other')]];
    const byMode = data?.byMode || {};

    const tiles = [
        { label: t('totalBilled'), value: data?.totalBilled, icon: TrendingUp, tone: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' }, hint: `${data?.orderCount || 0} ${t('ordersWord').toLowerCase()}` },
        { label: t('collected'), value: data?.totalCollected, icon: RupeeIcon, tone: { bg: '#dcfce7', fg: 'var(--success-600)' }, hint: t('received') },
        { label: t('outstandingWord'), value: data?.outstanding, icon: Wallet, tone: { bg: '#fef3c7', fg: 'var(--accent-600)' }, hint: `${data?.outstandingDealers || 0} ${t('dealersWord')}` },
        { label: `${t('collected')} · ${periodLabel[period]}`, value: data?.periodCollected, icon: Boxes, tone: { bg: '#e0e7ff', fg: 'var(--brand-700)' }, hint: `${data?.periodPayments || 0} ${t('paymentsWord')}` },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('accountTally')}</h1>
                <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile('whoply-payments.csv', paymentsToCsv(data?.recentPayments || []))} disabled={!(data?.recentPayments || []).length}><Download size={16} /> {t('exportCsv')}</button>
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {PERIODS.map((p) => (
                    <button key={p.k} onClick={() => setPeriod(p.k)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={period === p.k ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {periodLabel[p.k]}
                    </button>
                ))}
            </div>

            {/* Tally tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {tiles.map((tile) => (
                    <div key={tile.label} className="wp-card p-5">
                        <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: tile.tone.bg, color: tile.tone.fg }}><tile.icon size={18} /></div>
                        <p className="mt-3 text-xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(tile.value || 0)}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tile.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tile.hint}</p>
                    </div>
                ))}
            </div>

            {/* Billed = Collected + Outstanding tally bar */}
            <div className="wp-card p-5">
                <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={17} style={{ color: 'var(--brand-700)' }} /> {t('moneyToCollect')}</h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('totalBilled')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--text-primary)' }}>{inr(data?.totalBilled || 0)}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('collected')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--success-600)' }}>{inr(data?.totalCollected || 0)}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('outstandingWord')}</p>
                        <p className="text-base sm:text-xl font-extrabold tabular leading-tight mt-1" style={{ color: 'var(--accent-600)' }}>{inr(data?.outstanding || 0)}</p>
                    </div>
                </div>
                <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>{t('tallyFormulaNote')}</p>
            </div>

            {/* Money in by mode — for the selected period */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><RupeeIcon size={17} style={{ color: 'var(--brand-700)' }} /> {t('collected')} · {periodLabel[period]}</h3>
                    <span className="text-sm font-bold tabular" style={{ color: 'var(--brand-700)' }}>{inr(data?.periodCollected || 0)}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                    {modes.map(([k, label]) => (
                        <div key={k} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
                            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{label}</p>
                            <p className="text-sm sm:text-base font-extrabold tabular mt-0.5" style={{ color: 'var(--text-primary)' }}>{inr(byMode[k] || 0)}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top debtors */}
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Building2 size={16} /> {t('dealersOweYou')}</h3>
                    {(data?.topDebtors || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('allDealersSettled')}</p>}
                    {(data?.topDebtors || []).map((d: any, i: number) => (
                        <div key={d._id} className="flex items-center gap-2 py-2" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{d.city || '—'}{d.mobile ? ` · ${d.mobile}` : ''}</p>
                            </div>
                            <span className="text-sm font-bold tabular shrink-0" style={{ color: 'var(--accent-600)' }}>{inr2(d.outstanding)}</span>
                            {d.mobile && <button className="wp-btn wp-btn-ghost !p-2 shrink-0" title={t('sendReminderWa')} onClick={() => remindDealer(d)}><MessageCircle size={14} style={{ color: 'var(--success-600)' }} /></button>}
                        </div>
                    ))}
                </div>

                {/* Recent payments */}
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={16} /> {t('recentPayments')}</h3>
                    {(data?.recentPayments || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noPayments')}</p>}
                    {(data?.recentPayments || []).map((p: any, i: number) => (
                        <div key={p._id} className="flex items-center gap-2 py-2" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <ShoppingBag size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.dealerName || t('dealer')}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.orderNo || t('onAccount')} · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t('mode_' + p.mode)}</p>
                            </div>
                            <span className="text-sm font-bold tabular shrink-0" style={{ color: 'var(--success-600)' }}>{inr2(p.amount)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ───────────────────────── Shopkeeper — reports (unchanged) ───────────────────────── */
type Period = 'week' | 'month' | 'quarter' | 'year';
const PERIODS: { k: Period; label: string }[] = [
    { k: 'week', label: 'Weekly' },
    { k: 'month', label: 'Monthly' },
    { k: 'quarter', label: 'Quarterly' },
    { k: 'year', label: 'Yearly' },
];

function ShopReports() {
    const t = useT();
    const [period, setPeriod] = useState<Period>('month');
    const periodLabel: Record<Period, string> = { week: t('weekly'), month: t('monthly'), quarter: t('quarterly'), year: t('yearly') };

    const { data: summary } = useQuery({ queryKey: ['rep-summary', period], queryFn: async () => (await api.get(`/shopkeeper/reports/summary?period=${period}`)).data.data });
    const monthDays = new Date().getDate(); // days elapsed this month → "this month" chart
    const { data: sales } = useQuery({ queryKey: ['rep-sales', 'month'], queryFn: async () => (await api.get(`/shopkeeper/reports/sales?days=${monthDays}`)).data.data });
    const { data: prod } = useQuery({ queryKey: ['rep-prod'], queryFn: async () => (await api.get('/shopkeeper/reports/products')).data.data });
    const { data: dayClose } = useQuery({ queryKey: ['rep-dayclose'], queryFn: async () => (await api.get('/shopkeeper/reports/day-close')).data.data, refetchOnMount: 'always' });

    // Fill in every day of this month (1 → today) so the chart shows real highs & lows, not just days that had a sale.
    const monthSeries = useMemo(() => {
        const map = new Map((sales?.daily || []).map((d: any) => [d.date, d.sales]));
        const now = new Date();
        const arr: { date: string; day: number; sales: number }[] = [];
        for (let day = 1; day <= now.getDate(); day++) {
            const ds = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            arr.push({ date: ds, day, sales: (map.get(ds) as number) || 0 });
        }
        return arr;
    }, [sales]);
    const maxSale = Math.max(1, ...monthSeries.map((d) => d.sales));
    const monthTotal = monthSeries.reduce((s, d) => s + d.sales, 0);
    const kfmt = (n: number) => (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));

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
        { label: t('moneyInStock'), value: summary?.investmentAtCost, icon: Boxes, tone: { bg: 'var(--brand-100)', fg: 'var(--brand-700)' }, hint: 'cash sitting in your stock' },
        { label: t('salesWord'), value: summary?.revenue, icon: RupeeIcon, tone: { bg: '#dcfce7', fg: 'var(--success-600)' }, hint: `${summary?.orders || 0} ${t('bills').toLowerCase()}` },
        { label: t('profitBeforeExpenses'), value: summary?.grossProfit, icon: TrendingUp, tone: { bg: '#e0e7ff', fg: 'var(--brand-700)' }, hint: 'sales − cost of items' },
        { label: t('finalProfit'), value: summary?.netProfit, icon: TrendingUp, tone: { bg: '#dcfce7', fg: 'var(--success-600)' }, hint: 'after rent, salary, etc.' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('reportsAccounts')}</h1>
                <button className="wp-btn wp-btn-ghost" onClick={downloadCsv}><Download size={16} /> {t('exportCsv')}</button>
            </div>

            {/* Period tabs */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
                {PERIODS.map((p) => (
                    <button key={p.k} onClick={() => setPeriod(p.k)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={period === p.k ? { background: 'var(--card-bg)', color: 'var(--brand-700)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-secondary)' }}>
                        {periodLabel[p.k]}
                    </button>
                ))}
            </div>

            {/* Day close — today's cash tally */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Wallet size={17} style={{ color: 'var(--brand-700)' }} /> {t('dayCloseToday')}</h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dayClose?.billCount || 0} bills · sold {inr(dayClose?.totalSales || 0)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('cashLabel')}</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(dayClose?.cash || 0)}</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>UPI</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(dayClose?.upi || 0)}</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Card</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(dayClose?.card || 0)}</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('udharGiven')}</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--accent-600)' }}>{inr(dayClose?.udharGiven || 0)}</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('udharCollected')}</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--success-600)' }}>{inr(dayClose?.udharCollected || 0)}</p></div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('expensesTodayLabel')}</p><p className="text-base sm:text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(dayClose?.expenses || 0)}</p></div>
                </div>
                <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--card-border)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('cashCollectedToday')}</span>
                    <span className="text-xl font-extrabold tabular" style={{ color: 'var(--success-600)' }}>{inr((dayClose?.cash || 0) + (dayClose?.udharCollected || 0))}</span>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Cash sales + udhar collected today. All figures are for <b>today only</b>. Any expenses you paid from the cash box, subtract separately.</p>
            </div>

            {/* Tally tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {tiles.map((tile) => (
                    <div key={tile.label} className="wp-card p-5">
                        <div className="h-10 w-10 grid place-items-center rounded-xl" style={{ background: tile.tone.bg, color: tile.tone.fg }}><tile.icon size={18} /></div>
                        <p className="mt-3 text-xl font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{inr(tile.value || 0)}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tile.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tile.hint}</p>
                    </div>
                ))}
            </div>

            {/* Cost breakdown — plain words */}
            <div className="wp-card p-5 grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('costOfItemsSold')}</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.cogs || 0)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('otherExpenses')}</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.otherExpenses || 0)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('staffSalaryLabel')}</p><p className="text-lg font-bold tabular" style={{ color: 'var(--text-primary)' }}>{inr(summary?.staffSalaryForPeriod || 0)}</p></div>
            </div>

            {/* Sales bars — this month */}
            <div className="wp-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><RupeeIcon size={17} style={{ color: 'var(--brand-700)' }} /> {t('salesThisMonth')}</h3>
                    <span className="text-sm font-bold tabular" style={{ color: 'var(--brand-700)' }}>{inr(monthTotal)}</span>
                </div>
                {monthTotal === 0 && <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('noSalesThisMonth')}</p>}
                {monthTotal > 0 && (
                    <div className="flex items-stretch gap-0.5 sm:gap-1 h-52">
                        {monthSeries.map((d) => {
                            const pct = Math.max(2, Math.round((d.sales / maxSale) * 100));
                            return (
                                <div key={d.date} className="flex-1 min-w-[12px] flex flex-col" title={`${d.date}: ${inr(d.sales)}`}>
                                    <div className="flex-1 flex items-end">
                                        <div className="w-full rounded-t-md relative" style={{ height: `${pct}%`, background: d.sales > 0 ? 'var(--brand-700)' : 'var(--card-border)' }}>
                                            {d.sales > 0 && <span className="absolute left-1/2 -translate-x-1/2 -top-3.5 text-[8px] font-semibold tabular whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{kfmt(d.sales)}</span>}
                                        </div>
                                    </div>
                                    <span className="text-[9px] text-center mt-1" style={{ color: 'var(--text-muted)' }}>{d.day}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('bestSellers')}</h3>
                    {(prod?.best || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between py-1.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                            <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{p.qty} · {inr(p.revenue)}</span>
                        </div>
                    ))}
                </div>
                <div className="wp-card p-5">
                    <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('slowMovers')}</h3>
                    {(prod?.slow || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between py-1.5 text-sm" style={{ borderTop: i ? '1px solid var(--card-border)' : 'none' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                            <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{p.stock} {t('inStock')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
