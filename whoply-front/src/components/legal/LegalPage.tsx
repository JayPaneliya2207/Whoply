import type { ReactNode } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LEGAL, missingLegalFields, orPending } from '@/lib/legal';

export interface LegalSection {
    id: string;
    title: string;
    body: ReactNode;
}

/**
 * Shared frame for the Privacy Policy and Terms: slim navy header, a Draft
 * banner while company details are missing (lib/legal.ts), a table of contents
 * and readable long-form sections. English only for now (legal text needs a
 * reviewed translation, not a machine one): the Hindi and Gujarati footers
 * label these links "in English", and the page says so in both languages.
 */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
    const missing = missingLegalFields();
    return (
        <div className="min-h-screen bg-bg">
            <header className="bg-navy">
                <div className="wrap flex h-14 items-center justify-between sm:h-16">
                    <a href="/" aria-label="Whoply home">
                        <Logo size={28} onNavy />
                    </a>
                    <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-[#E5E7EB] hover:text-white">
                        <ArrowLeft size={16} aria-hidden="true" /> Back to home
                    </a>
                </div>
            </header>

            <main className="wrap py-10 sm:py-14">
                <article className="mx-auto max-w-3xl">
                    {missing.length > 0 && (
                        <div role="note" className="mb-8 flex gap-3 rounded-xl border border-warning/40 bg-warning-tint p-4 text-sm text-warning">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p>
                                <b>Draft.</b> This page is not final until these details are added: {missing.join(', ')}. Get it reviewed by a
                                lawyer before launch.
                            </p>
                        </div>
                    )}

                    <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">{title}</h1>
                    <p className="mt-2 text-sm text-muted">
                        <span lang="hi">यह पेज अभी सिर्फ़ अंग्रेज़ी में है।</span> · <span lang="gu">આ પેજ હાલ ફક્ત અંગ્રેજીમાં છે.</span>
                    </p>
                    <p className="mt-2 text-sm text-muted">Effective from {orPending(LEGAL.effectiveDate)}</p>
                    <div className="mt-6 space-y-3 text-[1.02rem] leading-relaxed text-text">{intro}</div>

                    <nav aria-label="Contents" className="mt-8 rounded-card border border-border bg-surface p-5">
                        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Contents</p>
                        <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                            {sections.map((s, i) => (
                                <li key={s.id}>
                                    <a href={`#${s.id}`} className="text-navy hover:underline">
                                        {i + 1}. {s.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    {sections.map((s, i) => (
                        <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
                            <h2 className="font-display text-xl font-bold text-navy">
                                {i + 1}. {s.title}
                            </h2>
                            <div className="legal-body mt-3 space-y-3 text-[1.02rem] leading-relaxed text-text">{s.body}</div>
                        </section>
                    ))}
                </article>
            </main>

            <footer className="bg-navy-dark">
                <div className="wrap flex flex-col gap-3 py-8 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
                    <span>© {new Date().getFullYear()} {LEGAL.entityName || 'Whoply'}</span>
                    <span className="flex gap-5">
                        <a href="/privacy" className="hover:text-white">Privacy Policy</a>
                        <a href="/terms" className="hover:text-white">Terms of Service</a>
                        <a href="/" className="hover:text-white">Home</a>
                    </span>
                </div>
            </footer>
        </div>
    );
}
