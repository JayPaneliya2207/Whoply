import Image from 'next/image';
import { BadgeCheck, Package, RotateCcw, Smartphone, UploadCloud, type LucideIcon } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { MEDIA } from '@/lib/media';
import { Reveal, RevealWords } from './Reveal';

const STEP_ICONS: LucideIcon[] = [Smartphone, Package, UploadCloud];
const CHIP_ICONS: LucideIcon[] = [Smartphone, BadgeCheck, RotateCcw];

/**
 * "Get started" and "Install" as one section. A light aurora backdrop (cream
 * base, slow peach / teal / indigo glows, fine dot texture) carries three
 * white step cards on a dashed track, then a deep navy install card with a
 * warm glow as the section's focal point.
 */
export function GetStarted({ lang }: { lang: Lang }) {
    const t = getCopy(lang);

    return (
        <section id="how" className="relative overflow-hidden bg-[#fffaf5]">
            {/* ── Aurora backdrop ───────────────────────────────── */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="mesh-blob mesh-a -top-[12%] -left-[10%] h-[55vw] w-[55vw] max-h-[620px] max-w-[620px] bg-[#ffc59a]/60" />
                <div className="mesh-blob mesh-b top-[8%] -right-[14%] h-[50vw] w-[50vw] max-h-[560px] max-w-[560px] bg-[#99f6e4]/45" />
                <div className="mesh-blob mesh-c bottom-[-12%] left-[25%] h-[48vw] w-[48vw] max-h-[540px] max-w-[540px] bg-[#c7d2fe]/55" />
                <div className="get-started-dots absolute inset-0" />
                {/* Soft fades so the section blends into its neighbours. */}
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-navy-tint to-transparent" />
            </div>

            <div className="wrap relative py-20 md:py-28">
                {/* ── Header ─────────────────────────────────────── */}
                <Reveal className="mx-auto max-w-2xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.16em] text-accent-strong uppercase shadow-sm backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {t.how.eyebrow}
                    </span>
                    <RevealWords
                        as="h2"
                        text={t.how.title}
                        className="mt-4 font-display text-3xl font-extrabold text-navy sm:text-[2.6rem] sm:leading-[1.12]"
                    />
                </Reveal>

                {/* ── Three steps on a dashed track ──────────────── */}
                <div className="relative mt-14">
                    <div aria-hidden="true" className="absolute top-[3.1rem] right-[16%] left-[16%] hidden border-t-2 border-dashed border-accent/35 md:block" />
                    <div className="relative grid gap-5 md:grid-cols-3">
                        {t.how.steps.map(([title, desc], i) => {
                            const Icon = STEP_ICONS[i];
                            return (
                                <Reveal key={title} variant="zoom" delay={i * 140} className="h-full">
                                    <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-7 shadow-xl shadow-navy/[0.07] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/15">
                                        <span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute -top-5 -right-1 font-display text-[7rem] leading-none font-extrabold text-navy/[0.05] select-none"
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e0701c] to-accent text-white shadow-lg shadow-accent/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                                            <Icon size={22} aria-hidden="true" />
                                        </span>
                                        <p className="relative mt-5 text-[11px] font-bold tracking-[0.16em] text-accent-strong uppercase">
                                            0{i + 1}
                                        </p>
                                        <h3 className="relative mt-1 font-display text-xl font-extrabold text-navy">{title}</h3>
                                        <p className="relative mt-2 leading-relaxed text-muted">{desc}</p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>

                {/* ── Install card ───────────────────────────────── */}
                <div id="install" className="mt-16 scroll-mt-24">
                    <Reveal>
                        <div className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-navy to-navy-light p-6 text-white shadow-2xl shadow-navy/30 ring-1 ring-white/10 sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
                            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                                <div className="mesh-blob mesh-b -top-24 -right-16 h-72 w-72 bg-accent/40" />
                                <div className="mesh-blob mesh-a -bottom-28 -left-20 h-72 w-72 bg-[#14b8a6]/25" />
                                <div className="ledger-mesh absolute inset-0" />
                            </div>
                            <div className="relative">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-sand uppercase ring-1 ring-white/15">
                                    {t.install.eyebrow}
                                </span>
                                <h3 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-[2.2rem] sm:leading-[1.15]">
                                    {t.install.title}
                                </h3>
                                <p className="mt-4 text-lg leading-relaxed text-white/80">{t.install.sub}</p>
                                <div className="mt-8 flex flex-wrap gap-3">
                                    {t.install.chips.map((label, i) => {
                                        const Icon = CHIP_ICONS[i];
                                        return (
                                            <Reveal key={label} variant="zoom" delay={i * 120}>
                                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-lg shadow-black/20">
                                                    <Icon size={16} aria-hidden="true" className="text-accent-strong" />
                                                    {label}
                                                </span>
                                            </Reveal>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
                                <div aria-hidden="true" className="absolute -inset-3 rotate-3 rounded-3xl bg-gradient-to-br from-accent/60 to-sand/40" />
                                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
                                    <Image
                                        src={MEDIA.kiranaStore.src}
                                        alt={MEDIA.kiranaStore.alt[lang]}
                                        fill
                                        sizes="(max-width: 1024px) 90vw, 480px"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}
