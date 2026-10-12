import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';

const LINKS: [string, string][] = [
    ['For shopkeepers', '/#shopkeepers'],
    ['For wholesalers', '/#wholesalers'],
    ['Pricing', '/#pricing'],
    ['FAQ', '/#faq'],
];

/**
 * 404 for the whole site. Any address that is not a real page lands here
 * (see [...missing]/page.tsx) — including /login and /signup, which do not
 * exist on the marketing site. Drawn as a shop bill for a page that is out
 * of stock.
 */
export default function NotFound() {
    return (
        <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-navy px-5 py-14 text-white">
            <title>Page not found — Whoply</title>
            <div aria-hidden="true" className="hero-dots pointer-events-none absolute inset-0 opacity-40" />
            <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-navy-light/70" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -left-40 h-[34rem] w-[34rem] rounded-full border border-sand/20" />

            <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="text-center lg:text-left">
                    <a href="/" aria-label="Whoply home" className="inline-flex">
                        <Logo size={34} onNavy />
                    </a>
                    <p aria-hidden="true" className="tabular mt-8 font-display text-[6.5rem] leading-none font-extrabold tracking-tight sm:text-[9rem]">
                        4<span className="text-sand">0</span>4
                    </p>
                    <h1 className="mt-4 font-display text-2xl font-extrabold sm:text-[2rem] sm:leading-tight">This page is not on our shelf</h1>
                    <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-white/70 lg:mx-0">
                        The link may be old, or the address was typed wrong. Everything else is right where you left it.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                        <a href="/" className="btn btn-primary">
                            <ArrowLeft size={17} aria-hidden="true" /> Back to home
                        </a>
                        <a href="/#contact" className="btn bg-white text-navy hover:bg-sand">
                            <MessageCircle size={17} aria-hidden="true" /> Contact us
                        </a>
                    </div>
                    <nav aria-label="Popular pages" className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm lg:justify-start">
                        {LINKS.map(([label, href]) => (
                            <a key={href} href={href} className="text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline">
                                {label}
                            </a>
                        ))}
                    </nav>
                </div>

                {/* The bill for a page we don't stock. Decorative — the heading says it in words. */}
                <div aria-hidden="true" className="mx-auto w-full max-w-[19rem] -rotate-2 lg:rotate-3">
                    <div className="rounded-t-2xl bg-[#fffdf8] px-6 pt-6 pb-5 font-mono text-[13px] leading-relaxed text-navy shadow-2xl shadow-navy-dark/60">
                        <p className="text-center font-display text-base font-extrabold tracking-wide">WHOPLY STORE</p>
                        <p className="text-center text-[11px] text-muted">Bill no. 404</p>
                        <div className="my-3 border-t border-dashed border-navy/25" />
                        <div className="flex justify-between gap-3"><span>The page you asked for</span><span>×1</span></div>
                        <div className="flex justify-between gap-3 text-danger"><span>Status</span><span>OUT OF STOCK</span></div>
                        <div className="flex justify-between gap-3 text-muted"><span>Home page</span><span>IN STOCK</span></div>
                        <div className="my-3 border-t border-dashed border-navy/25" />
                        <div className="flex justify-between gap-3 text-base font-bold"><span>Total</span><span>₹0.00</span></div>
                        <p className="mt-3 text-center text-[11px] text-muted">Thank you. Visit again.</p>
                    </div>
                    {/* Torn edge */}
                    <div className="h-3 bg-[#fffdf8] [mask-image:radial-gradient(circle_at_6px_100%,transparent_5px,#000_5.5px)] [mask-size:12px_12px] [mask-repeat:repeat-x]" />
                </div>
            </div>
        </main>
    );
}
