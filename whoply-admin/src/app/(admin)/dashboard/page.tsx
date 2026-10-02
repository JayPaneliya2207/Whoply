'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Users, IndianRupee, TrendingUp, TrendingDown, Store, Layers, Receipt, ShoppingBag, Wallet, Crown, ArrowRight, Sparkles, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { inr, inrShort } from '@/lib/cn';
import { useAuth } from '@/stores/auth.store';

type Tone = { bg: string; fg: string };
const T: Record<string, Tone> = {
    navy: { bg: 'var(--brand-tint)', fg: 'var(--brand-text)' },
    green: { bg: 'var(--success-tint)', fg: 'var(--success)' },
    amber: { bg: 'var(--warning-tint)', fg: 'var(--warning)' },
    orange: { bg: 'var(--accent-tint)', fg: 'var(--accent-strong)' },
};
const planTone: Record<string, React.CSSProperties> = {
    free: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
    pro: { background: 'var(--brand-tint)', color: 'var(--brand-text)' },
    business: { background: 'var(--warning-tint)', color: 'var(--warning)' },
};
const typeLabel = (t?: string) => (t === 'wholesale' ? 'Wholesale' : 'Retail');
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** KPI tile: tinted icon, small label, big number, one line of context, optional month-on-month chip. */
function Stat({ label, value, sub, icon: Icon, tone, href, i = 0, trend }: { label: string; value: string | number; sub?: string; icon: any; tone: Tone; href?: string; i?: number; trend?: number | null }) {
    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <div className="h-11 w-11 grid place-items-center rounded-2xl" style={{ background: tone.bg, color: tone.fg }}><Icon size={20} /></div>
                {trend != null && (
                    <span className="wp-chip" style={trend >= 0 ? { background: 'var(--success-tint)', color: 'var(--success)' } : { background: 'var(--danger-tint)', color: 'var(--danger)' }}>
                        {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-[26px] font-extrabold tabular leading-none mt-1.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
            {sub && <p className="text-xs mt-2 truncate" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </>
    );
    const cls = 'wp-card wp-card-hover p-5 block h-full';
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="h-full">
            {href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}
        </motion.div>
    );
}

function Card({ title, icon: Icon, action, children, className = '' }: { title: string; icon?: any; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={`wp-card p-5 ${className}`}>
            <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>{Icon && <Icon size={17} style={{ color: 'var(--brand-text)' }} />} {title}</h3>
                {action}
            </div>
            {children}
        </div>
    );
}

/** Six months of platform sales as stacked bars — navy for retail bills, orange for wholesale orders. */
function SalesBars({ months }: { months: any[] }) {
    const max = Math.max(1, ...months.map((m) => m.gmv));
    const H = 200;
    return (
        <div>
            <div className="flex items-end gap-2 sm:gap-4" style={{ height: H + 48 }}>
                {months.map((m) => {
                    const h = Math.round((m.gmv / max) * H);
                    const wholesaleShare = m.gmv ? (m.wholesaleGmv / m.gmv) * 100 : 0;
                    return (
                        <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full" title={`${m.label}: retail ${inr(m.retailGmv)} · wholesale ${inr(m.wholesaleGmv)} · ${m.bills} bills, ${m.orders} orders`}>
                            <span className="text-[11px] font-semibold tabular mb-1" style={{ color: 'var(--text-secondary)' }}>{m.gmv ? inrShort(m.gmv) : '–'}</span>
                            {m.gmv ? (
                                <div className="w-full max-w-[44px] rounded-t-lg overflow-hidden flex flex-col" style={{ height: Math.max(h, 4) }}>
                                    <div style={{ height: `${wholesaleShare}%`, background: 'var(--accent-bright)' }} />
                                    <div style={{ flex: 1, background: 'var(--brand-line)' }} />
                                </div>
                            ) : (
                                <div className="w-full max-w-[44px] rounded-t-lg" style={{ height: 3, background: 'var(--card-border)' }} />
                            )}
                            <span className="text-xs mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--brand-line)' }} /> Retail bills</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--accent-bright)' }} /> Wholesale orders</span>
            </div>
        </div>
    );
}

function Meter({ label, value, total, color, note }: { label: string; value: number; total: number; color: string; note: string }) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{value} / {total} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{note}</p>
        </div>
    );
}

function Mini({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub: string }) {
    return (
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><Icon size={13} /> {label}</div>
            <p className="text-lg font-extrabold tabular mt-1 leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-xs tabular mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
        </div>
    );
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: async () => (await api.get('/admin/stats')).data.data, refetchInterval: 60_000 });
    if (isLoading || !data) {
        return (
            <div className="space-y-4">
                <div className="h-14 w-72 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="wp-card h-36 animate-pulse" />)}</div>
                <div className="grid lg:grid-cols-3 gap-4"><div className="wp-card h-72 animate-pulse lg:col-span-2" /><div className="wp-card h-72 animate-pulse" /></div>
            </div>
        );
    }

    const tm = data.thisMonth || {};
    const top: any[] = data.topBusinesses || [];
    const recent: any[] = data.recentBusinesses || [];
    const maxTop = Math.max(1, ...top.map((b) => b.gmv));
    const totalSubs = (data.revenueByPlan || []).reduce((s: number, p: any) => s + p.subscribers, 0) || 1;

    return (
        <div className="space-y-5">
            {/* Greeting */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Platform overview</p>
                    <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{greeting()}, {user?.name?.split(' ')[0] || 'Admin'} 👋</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{data.businesses} businesses · {data.users} active logins · {(data.invoices || 0) + (data.orders || 0)} bills and orders so far</p>
                </div>
                <Link href="/businesses" className="wp-btn wp-btn-primary"><Building2 size={16} /> Businesses <ArrowRight size={14} /></Link>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <Stat i={0} label="Businesses" value={data.businesses} sub={`+${tm.newBusinesses || 0} this month · ${data.active} active`} icon={Building2} tone={T.navy} href="/businesses" />
                <Stat i={1} label="Active users" value={data.users} sub={`+${tm.newUsers || 0} new this month`} icon={Users} tone={T.orange} href="/users" />
                <Stat i={2} label="Monthly revenue" value={inr(data.mrr)} sub={`≈ ${inr(data.arr)} a year from subscriptions`} icon={IndianRupee} tone={T.green} href="/plans" />
                <Stat i={3} label="Sales this month" value={inr(tm.gmv || 0)} sub={`${tm.bills || 0} bills · ${tm.orders || 0} orders · last month ${inr(data.lastMonthGmv || 0)}`} icon={TrendingUp} tone={T.amber} trend={tm.growthPct} />
            </div>

            {/* Sales chart + subscription revenue */}
            <div className="grid lg:grid-cols-3 gap-4">
                <Card title="Sales on the platform — last 6 months" icon={ShoppingBag} className="lg:col-span-2" action={<span className="text-xs font-semibold tabular" style={{ color: 'var(--text-secondary)' }}>Lifetime {inr(data.gmv)}</span>}>
                    <SalesBars months={data.monthly || []} />
                </Card>
                <div className="space-y-4">
                    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)', color: '#fff' }}>
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <div className="absolute right-6 top-14 h-16 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <div className="flex items-center gap-2 text-sm" style={{ opacity: 0.9 }}><Wallet size={16} /> Subscription revenue</div>
                        <p className="text-3xl font-extrabold tabular mt-2 flex items-baseline gap-0.5"><IndianRupee size={24} strokeWidth={2.6} className="self-center" />{inr(data.mrr).slice(1)} <span className="text-sm font-semibold ml-1" style={{ opacity: 0.8 }}>/ month</span></p>
                        <p className="text-sm mt-1.5" style={{ opacity: 0.85 }}>≈ {inr(data.arr)} a year · {totalSubs} {totalSubs === 1 ? 'business' : 'businesses'} on a plan</p>
                    </div>
                    <Card title="By plan" icon={Crown}>
                        <div className="space-y-3.5">
                            {(data.revenueByPlan || []).map((p: any) => (
                                <div key={p.key}>
                                    <div className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="wp-chip capitalize" style={planTone[p.key] || planTone.free}>{p.plan}</span>
                                            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.price === 0 ? 'Free' : `${inr(p.price)} / ${p.period === 'year' ? 'yr' : 'mo'}`}</span>
                                        </span>
                                        <span className="tabular font-bold shrink-0" style={{ color: 'var(--success)' }}>{inr(p.monthlyRevenue)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${(p.subscribers / totalSubs) * 100}%`, background: 'var(--brand-line)' }} /></div>
                                        <span className="text-xs tabular shrink-0" style={{ color: 'var(--text-muted)' }}>{p.subscribers} {p.subscribers === 1 ? 'business' : 'businesses'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Top businesses · new sign-ups · health */}
            <div className="grid lg:grid-cols-3 gap-4">
                <Card title="Top businesses this month" icon={Crown}>
                    {!top.length && <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No sales yet this month.</p>}
                    <div className="space-y-3.5">
                        {top.map((b, i) => (
                            <Link key={b._id} href="/businesses" className="flex items-center gap-3">
                                <span className="h-7 w-7 grid place-items-center rounded-lg text-xs font-bold shrink-0" style={i === 0 ? { background: 'var(--warning-tint)', color: 'var(--warning)' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                                        <span className="text-sm font-bold tabular shrink-0" style={{ color: 'var(--text-primary)' }}>{inr(b.gmv)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${(b.gmv / maxTop) * 100}%`, background: b.type === 'wholesale' ? 'var(--accent-bright)' : 'var(--brand-line)' }} /></div>
                                        <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{typeLabel(b.type)} · {b.count} {b.type === 'wholesale' ? 'orders' : 'bills'}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </Card>

                <Card title="New businesses" icon={Sparkles} action={<Link href="/businesses" className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--brand-text)' }}>View all <ArrowRight size={12} /></Link>}>
                    {!recent.length && <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No businesses yet.</p>}
                    <div>
                        {recent.map((b, idx) => (
                            <div key={b._id} className="flex items-center gap-3 py-2.5" style={{ borderTop: idx ? '1px solid var(--card-border)' : 'none' }}>
                                <div className="h-9 w-9 grid place-items-center rounded-xl shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand-text)' }}>{b.type === 'wholesale' ? <Layers size={16} /> : <Store size={16} />}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.name}{!b.isActive && <span className="wp-chip ml-2" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>Suspended</span>}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{b.ownerName}{b.city ? ` · ${b.city}` : ''} · joined {shortDate(b.createdAt)}</p>
                                </div>
                                <span className="wp-chip capitalize shrink-0" style={planTone[b.plan] || planTone.free}>{b.plan}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Platform health" icon={Activity}>
                    <div className="space-y-4">
                        <Meter label="Active businesses" value={data.active} total={data.businesses} color="var(--success-fill)" note={`${data.suspended} suspended`} />
                        <Meter label="Retail shops" value={data.retail} total={data.businesses} color="var(--brand-line)" note={`${data.wholesale} wholesale`} />
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <Mini icon={Receipt} label="Retail bills" value={data.invoices} sub={inr(data.retailGmv)} />
                            <Mini icon={ShoppingBag} label="Wholesale orders" value={data.orders} sub={inr(data.wholesaleGmv)} />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
