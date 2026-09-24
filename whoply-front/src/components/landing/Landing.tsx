import { ArrowRight } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Logo } from '@/components/Logo';
import { Hero } from '@/components/landing/Hero';
import { Marquee } from '@/components/landing/Marquee';
import { Faq } from '@/components/landing/Faq';
import { Reveal, RevealWords } from '@/components/landing/Reveal';
import { Backdrop, type BackdropVariant } from '@/components/landing/Backdrop';
import { cn } from '@/lib/cn';
import { getCopy, HREF_LANG, type Lang } from '@/i18n/landing';
import { appEntry } from '@/lib/links';
import { StickyCta } from '@/components/landing/StickyCta';
import { CounterKit } from '@/components/landing/CounterKit';
import { DashboardShowcase } from '@/components/landing/DashboardShowcase';
import { FinalCta } from '@/components/landing/FinalCta';
import { PaperVsWhoply } from '@/components/landing/PaperVsWhoply';
import { CompliancePipeline } from '@/components/landing/CompliancePipeline';
import { FeatureTabs } from '@/components/landing/FeatureTabs';
import { WholesalePipeline } from '@/components/landing/WholesalePipeline';
import { Pricing, type Plan } from '@/components/landing/Pricing';
import { GetStarted } from '@/components/landing/GetStarted';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7000/api';

/** Mirrors the seeded plans — used when the API is unreachable at render time. */
const FALLBACK_PLANS: Plan[] = [
    {
        key: 'free',
        name: 'Free',
        price: 0,
        period: 'month',
        highlight: false,
        features: ['1 shop', 'Unlimited billing', 'Basic inventory', 'Udhar tracking'],
    },
    {
        key: 'pro',
        name: 'Pro',
        price: 299,
        period: 'month',
        highlight: true,
        features: [
            'Everything in Free',
            'GST reports & e-invoice',
            'Barcode scanning',
            '3 staff logins',
            'Reminder lists',
        ],
    },
    {
        key: 'business',
        name: 'Business',
        price: 799,
        period: 'month',
        highlight: false,
        features: [
            'Everything in Pro',
            'Full wholesale suite',
            'Dealers & price lists',
            'Dispatch & sales team',
            'Reorder suggestions',
        ],
    },
];

/**
 * Live plans from the API, cached for 5 minutes. Gives up after 3 seconds so
 * a slow or unreachable API never holds up the page — the fallback plans
 * render instead.
 */
async function getPlans(): Promise<Plan[]> {
    try {
        const res = await fetch(`${API_URL}/public/plans`, {
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return FALLBACK_PLANS;
        const json = await res.json();
        return json?.success && json.data?.length ? (json.data as Plan[]) : FALLBACK_PLANS;
    } catch {
        return FALLBACK_PLANS;
    }
}

/* ── Layout helpers ──────────────────────────────────────── */

function Section({
    id,
    children,
    className,
    bg,
}: {
    id?: string;
    children: React.ReactNode;
    className?: string;
    bg?: BackdropVariant;
}) {
    return (
        <section
            id={id}
            className={cn('relative', bg && 'overflow-hidden', bg === 'navy' && 'bg-navy', bg === 'tint' && 'bg-navy-tint', className)}
        >
            {bg && <Backdrop variant={bg} />}
            <div className="wrap relative py-20 md:py-28">{children}</div>
        </section>
    );
}

function SectionHead({
    eyebrow,
    title,
    sub,
    onNavy = false,
    align = 'center',
}: {
    eyebrow: string;
    title: string;
    sub?: string;
    onNavy?: boolean;
    align?: 'center' | 'left';
}) {
    return (
        <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
            <span className={`eyebrow ${onNavy ? 'eyebrow-on-navy' : ''}`}>{eyebrow}</span>
            <RevealWords
                as="h2"
                text={title}
                className={`mt-3 font-display text-3xl font-extrabold sm:text-[2.5rem] sm:leading-[1.15] ${
                    onNavy ? 'text-white' : 'text-navy'
                }`}
            />
            {sub && <p className={`mt-4 text-lg leading-relaxed ${onNavy ? 'text-white/70' : 'text-muted'}`}>{sub}</p>}
        </Reveal>
    );
}

/** Section head with its CTA beside it on desktop, under it on a phone. */
function FeatureHead({ eyebrow, title, sub, cta, href }: { eyebrow: string; title: string; sub: string; cta: string; href: string }) {
    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHead align="left" eyebrow={eyebrow} title={title} sub={sub} />
            <Reveal delay={200} className="shrink-0">
                <a href={href} className="btn btn-primary">
                    {cta} <ArrowRight size={17} aria-hidden="true" />
                </a>
            </Reveal>
        </div>
    );
}

/* ── Page ────────────────────────────────────────────────── */

export async function Landing({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const plans = await getPlans();


    return (
        <div lang={HREF_LANG[lang]}>
            <Nav lang={lang} />
            <main>
                <Hero lang={lang} />
                <Marquee lang={lang} />

                {/* ── Problem ─────────────────────────────── */}
                <Section id="problem" bg="glow">
                    <SectionHead eyebrow={t.problem.eyebrow} title={t.problem.title} />
                    <PaperVsWhoply lang={lang} />
                </Section>

                {/* ── Compliance ──────────────────────────── */}
                <Section id="compliance" bg="navy">
                    <SectionHead
                        onNavy
                        eyebrow={t.compliance.eyebrow}
                        title={t.compliance.title}
                        sub={t.compliance.sub}
                    />
                    <CompliancePipeline lang={lang} />
                    <p className="mt-12 text-center font-display text-xl font-bold text-sand">{t.compliance.quote}</p>
                </Section>

                {/* ── For shopkeepers ─────────────────────── */}
                <Section id="shopkeepers" bg="retail">
                    <FeatureHead
                        eyebrow={t.shopkeepers.eyebrow}
                        title={t.shopkeepers.title}
                        sub={t.shopkeepers.sub}
                        cta={t.shopkeepers.cta}
                        href={appEntry(lang, 'retail')}
                    />
                    <FeatureTabs lang={lang} className="mt-12" />

                    {/* The counter hardware it works with, and the headline numbers. */}
                    <Reveal className="mt-20">
                        <CounterKit lang={lang} />
                    </Reveal>
                </Section>

                {/* ── For wholesalers ─────────────────────── */}
                <Section id="wholesalers" bg="tint">
                    <FeatureHead
                        eyebrow={t.wholesalers.eyebrow}
                        title={t.wholesalers.title}
                        sub={t.wholesalers.sub}
                        cta={t.wholesalers.cta}
                        href={appEntry(lang, 'wholesale')}
                    />
                    <Reveal className="mt-12">
                        <WholesalePipeline lang={lang} />
                    </Reveal>
                </Section>

                {/* ── Get started + install ───────────────── */}
                <GetStarted lang={lang} />

                {/* ── Product tour ────────────────────────── */}
                <Section id="tour" bg="navy">
                    <SectionHead onNavy eyebrow={t.tour.eyebrow} title={t.tour.title} sub={t.tour.sub} />
                    <DashboardShowcase lang={lang} />
                </Section>

                {/* ── Pricing ─────────────────────────────── */}
                <Section id="pricing" bg="pricing">
                    <SectionHead eyebrow={t.pricing.eyebrow} title={t.pricing.title} sub={t.pricing.sub} />
                    <p className="mt-6 text-center text-sm font-semibold text-accent-strong">{t.pricing.anchor}</p>

                    <Pricing lang={lang} plans={plans} />

                    <p className="mt-8 text-center text-sm text-muted">{t.pricing.foot}</p>
                </Section>

                {/* ── FAQ ─────────────────────────────────── */}
                <Section id="faq" bg="faq">
                    <SectionHead eyebrow={t.faq.eyebrow} title={t.faq.title} />
                    <Faq lang={lang} />
                </Section>

                {/* ── Final CTA ───────────────────────────── */}
                <FinalCta lang={lang} />
            </main>

            {/* ── Footer ──────────────────────────────────── */}
            <footer className="bg-navy-dark">
                <div className="wrap py-16">
                    <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                        <div>
                            <Logo size={30} onNavy />
                            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{t.footer.tagline}</p>
                        </div>
                        {t.footer.columns.map((col) => (
                            <div key={col.head}>
                                <p className="font-display text-sm font-bold text-white">{col.head}</p>
                                <ul className="mt-4 space-y-2.5">
                                    {col.links.map(([label, href]) => (
                                        <li key={label}>
                                            <a
                                                href={href}
                                                className="text-sm text-white/60 transition-colors hover:text-white"
                                            >
                                                {label}
                                            </a>
                                        </li>
                                    ))}
                                    {col.head === t.footer.columns[0].head && (
                                        <li>
                                            <a
                                                href={appEntry(lang)}
                                                className="text-sm text-white/60 transition-colors hover:text-white"
                                            >
                                                {t.nav.login}
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 border-t border-white/10 pt-6 text-sm text-white/50">{t.footer.legal}</div>
                </div>
            </footer>

            <StickyCta lang={lang} />
        </div>
    );
}
