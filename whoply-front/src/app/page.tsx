'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowRight, Package, Receipt, Wallet, Truck, BarChart3, Users, Check,
    Store, Building2, ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Logo } from '@/components/Logo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7200';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api';

interface Plan { key: string; name: string; price: number; period: string; features: string[]; highlight: boolean; }

const inrPrice = (n: number) => (n === 0 ? '₹0' : `₹${n.toLocaleString('en-IN')}`);

const stats = [
    { k: '12,000+', v: 'Shopkeepers' },
    { k: '1,800+', v: 'Wholesalers' },
    { k: '4.2M', v: 'GST invoices' },
    { k: '22', v: 'States' },
];

const features = [
    { icon: Package, title: 'Smart Inventory', desc: 'Low-stock & expiry alerts, fast/slow movers, one-tap reorder.' },
    { icon: Receipt, title: 'GST Billing (POS)', desc: 'Fast, GST-ready invoices in seconds. Cash, UPI, card or credit.' },
    { icon: Wallet, title: 'Udhar Management', desc: 'Track every customer’s credit with automatic WhatsApp reminders.' },
    { icon: Truck, title: 'Orders & Dispatch', desc: 'Bulk orders, warehouse, dispatch and delivery tracking for wholesalers.' },
    { icon: BarChart3, title: 'Business Insights', desc: 'Today’s sales, profit, best-sellers and daily summaries.' },
    { icon: Users, title: 'Multi-role Access', desc: 'Owner, cashier, warehouse and sales staff — each sees only their work.' },
];

const steps = [
    { n: '1', title: 'Sign up in 30 seconds', desc: 'Login with OTP or password. Choose retail shop or wholesale.' },
    { n: '2', title: 'Add products & bill', desc: 'Import your catalog, scan barcodes and start GST billing instantly.' },
    { n: '3', title: 'Grow with insights', desc: 'Track profit, chase udhar and never run out of stock again.' },
];

// fallback plans (used only if the API is unreachable)
const fallbackPlans: Plan[] = [
    { key: 'free', name: 'Free', price: 0, period: 'month', features: ['1 shop', 'Unlimited billing', 'Basic inventory', 'Udhar tracking'], highlight: false },
    { key: 'pro', name: 'Pro', price: 299, period: 'month', features: ['Everything in Free', 'WhatsApp reminders', 'GST reports', 'Barcode scanning', '3 staff logins'], highlight: true },
    { key: 'business', name: 'Business', price: 799, period: 'month', features: ['Everything in Pro', 'Wholesale suite', 'Dealers & price-lists', 'Dispatch & sales-team', 'AI reorder'], highlight: false },
];

export default function Landing() {
    const [plans, setPlans] = useState<Plan[]>(fallbackPlans);
    useEffect(() => {
        fetch(`${API_URL}/public/plans`)
            .then((r) => r.json())
            .then((j) => { if (j?.success && j.data?.length) setPlans(j.data); })
            .catch(() => { /* keep fallback */ });
    }, []);

    return (
        <div style={{ background: 'var(--background)' }}>
            <Nav />

            {/* Hero */}
            <section className="wp-gradient">
                <div className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-10 items-center">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="wp-chip" style={{ background: 'var(--brand-100)', color: 'var(--brand-800)' }}>
                            <Sparkles size={13} /> Built for Bharat’s shops & wholesalers
                        </span>
                        <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            Run your entire business<br />from <span style={{ color: 'var(--brand-700)' }}>one simple app.</span>
                        </h1>
                        <p className="mt-5 text-lg max-w-md" style={{ color: 'var(--text-secondary)' }}>
                            Billing, inventory, udhar, orders and insights — Whoply replaces your bahi-khata, calculator and WhatsApp chaos.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a href={`${APP_URL}/login`} className="wp-btn wp-btn-primary">Get started free <ArrowRight size={17} /></a>
                            <a href="#features" className="wp-btn wp-btn-ghost">See features</a>
                        </div>
                        <div className="mt-6 flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1.5"><ShieldCheck size={15} /> No card needed</span>
                            <span className="flex items-center gap-1.5"><Smartphone size={15} /> Works offline</span>
                        </div>
                    </motion.div>

                    {/* Hero mock card */}
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="relative">
                        <div className="wp-card p-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-9 w-9 grid place-items-center rounded-lg" style={{ background: 'var(--brand-700)', color: '#fff' }}><Store size={17} /></div>
                                    <div><p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sharma General Store</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today’s summary</p></div>
                                </div>
                                <span className="wp-chip" style={{ background: '#dcfce7', color: 'var(--success-600)' }}>Live</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {[['Today’s Sales', '₹10,380'], ['Orders', '18'], ['Profit (est.)', '₹11,696'], ['Udhar due', '₹49,299']].map(([l, v]) => (
                                    <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</p>
                                        <p className="text-lg font-extrabold tabular" style={{ color: 'var(--text-primary)' }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--brand-700)', color: '#fff' }}>
                                <span className="text-sm font-semibold flex items-center gap-2"><Receipt size={16} /> New GST Bill</span>
                                <ArrowRight size={16} />
                            </div>
                        </div>
                        <div className="absolute -bottom-4 -left-4 wp-card p-3 hidden sm:flex items-center gap-2" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <div className="h-8 w-8 grid place-items-center rounded-lg" style={{ background: '#fef3c7', color: 'var(--accent-600)' }}><Wallet size={15} /></div>
                            <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Udhar reminder sent</p><p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>via WhatsApp ✓</p></div>
                        </div>
                    </motion.div>
                </div>

                {/* Stats bar */}
                <div className="max-w-6xl mx-auto px-5 pb-16">
                    <div className="wp-card grid grid-cols-2 md:grid-cols-4 divide-x" style={{ borderColor: 'var(--card-border)' }}>
                        {stats.map((s) => (
                            <div key={s.v} className="p-6 text-center">
                                <p className="text-3xl font-extrabold" style={{ color: 'var(--brand-700)' }}>{s.k}</p>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.v}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Audience */}
            <section className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-5">
                {[
                    { icon: Store, tag: 'For Shopkeepers', title: 'Retail made effortless', points: ['Lightning-fast POS billing', 'Expiry & low-stock alerts', 'Udhar with auto reminders', 'Daily profit at a glance'] },
                    { icon: Building2, tag: 'For Wholesalers', title: 'Distribution under control', points: ['Dealer-wise price lists', 'Bulk order intake', 'Dispatch & delivery tracking', 'Sales-team & commissions'] },
                ].map((c) => (
                    <div key={c.tag} className="wp-card wp-card-hover p-7">
                        <div className="h-12 w-12 grid place-items-center rounded-xl mb-4" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><c.icon size={22} /></div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--accent-600)' }}>{c.tag}</p>
                        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                        <ul className="space-y-2">
                            {c.points.map((p) => (
                                <li key={p} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <Check size={16} style={{ color: 'var(--success-600)' }} /> {p}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>

            {/* Features */}
            <section id="features" className="max-w-6xl mx-auto px-5 py-16">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Everything your business needs</h2>
                    <p className="mt-3" style={{ color: 'var(--text-secondary)' }}>One app that replaces a dozen registers, apps and spreadsheets.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="wp-card wp-card-hover p-6">
                            <div className="h-11 w-11 grid place-items-center rounded-xl mb-4" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}><f.icon size={20} /></div>
                            <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section id="how" className="py-16" style={{ background: 'var(--surface-2)' }}>
                <div className="max-w-6xl mx-auto px-5">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Live in three steps</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {steps.map((s) => (
                            <div key={s.n} className="wp-card p-7">
                                <div className="h-10 w-10 grid place-items-center rounded-full font-extrabold mb-4" style={{ background: 'var(--brand-700)', color: '#fff' }}>{s.n}</div>
                                <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="max-w-6xl mx-auto px-5 py-16">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Simple, honest pricing</h2>
                    <p className="mt-3" style={{ color: 'var(--text-secondary)' }}>Start free. Upgrade when you grow.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-5 items-start">
                    {plans.map((p) => (
                        <div key={p.key} className="wp-card p-7 relative" style={p.highlight ? { borderColor: 'var(--brand-700)', boxShadow: 'var(--shadow-lg)' } : {}}>
                            {p.highlight && <span className="wp-chip absolute -top-3 left-7" style={{ background: 'var(--accent-500)', color: '#1a1205' }}>Most popular</span>}
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                            <p className="mt-2"><span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{inrPrice(p.price)}</span><span style={{ color: 'var(--text-muted)' }}>/{p.period}</span></p>
                            <ul className="mt-5 space-y-2 mb-6">
                                {p.features.map((f) => (
                                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><Check size={16} style={{ color: 'var(--success-600)' }} /> {f}</li>
                                ))}
                            </ul>
                            <a href={`${APP_URL}/login`} className={`wp-btn w-full ${p.highlight ? 'wp-btn-primary' : 'wp-btn-ghost'}`}>{p.price === 0 ? 'Start free' : `Choose ${p.name}`}</a>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-6xl mx-auto px-5 pb-20">
                <div className="rounded-3xl p-10 sm:p-14 text-center" style={{ background: 'var(--brand-700)' }}>
                    <h2 className="text-3xl font-extrabold text-white">Ready to modernise your shop?</h2>
                    <p className="mt-3 text-white/80 max-w-lg mx-auto">Join thousands of shopkeepers and wholesalers running smarter with Whoply.</p>
                    <a href={`${APP_URL}/login`} className="wp-btn wp-btn-accent mt-7 inline-flex">Get started free <ArrowRight size={17} /></a>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid var(--card-border)' }}>
                <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Logo size={26} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>© 2026 Whoply. Made in India for Bharat’s businesses.</p>
                    <div className="flex gap-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <a href="#features">Features</a><a href="#pricing">Pricing</a><a href={`${APP_URL}/login`}>Login</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
