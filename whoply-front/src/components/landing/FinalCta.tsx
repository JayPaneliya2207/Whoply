'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getCopy, type Lang } from '@/i18n/landing';
import { MEDIA } from '@/lib/media';
import { appEntry } from '@/lib/links';
import { Reveal } from './Reveal';
import { Magnetic } from './Motion';

/**
 * The closing ask. The shop opens up as you arrive — an inset, rounded frame
 * that widens to full bleed while the photo settles from a slight zoom — and
 * then dissolves into the navy the copy sits on. Stays `#final-cta`: the
 * sticky CTA bar steps aside when this comes into view.
 */
export function FinalCta({ lang }: { lang: Lang }) {
    const t = getCopy(lang).finalCta;
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.1'] });
    const side = useTransform(scrollYProgress, [0, 1], [7, 0]);
    const top = useTransform(scrollYProgress, [0, 1], [5, 0]);
    const round = useTransform(scrollYProgress, [0, 1], [36, 0]);
    const clipPath = useMotionTemplate`inset(${top}% ${side}% 0% ${side}% round ${round}px ${round}px 0px 0px)`;
    const scale = useTransform(scrollYProgress, [0, 1], [1.16, 1]);

    return (
        <section id="final-cta" className="relative overflow-hidden bg-navy">
            <div ref={ref} className="relative">
                <motion.div
                    style={reduce ? undefined : { clipPath }}
                    className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-[21/10]"
                >
                    <motion.div style={reduce ? undefined : { scale }} className="absolute inset-0">
                        {/* Decorative — the headline carries the message. */}
                        <Image
                            src={MEDIA.storeCounter.src}
                            alt=""
                            aria-hidden="true"
                            fill
                            sizes="100vw"
                            className="object-cover object-[50%_38%]"
                        />
                    </motion.div>
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-b from-navy/30 via-navy/75 via-58% to-navy to-92%"
                    />
                </motion.div>

                {/* White on the lower, solid-navy part of the fade clears AA. */}
                <Reveal className="relative z-10 mx-auto -mt-20 max-w-3xl px-5 pb-24 text-center sm:-mt-36 lg:-mt-52">
                    <span className="eyebrow eyebrow-on-navy">{t.eyebrow}</span>
                    <h2 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-[2.75rem] sm:leading-[1.12]">
                        {t.title}
                    </h2>
                    <p className="mx-auto mt-5 max-w-lg text-lg text-white/75">{t.sub}</p>
                    <Magnetic className="mt-9">
                        <a href={appEntry(lang)} className="btn btn-primary btn-shine group">
                            {t.button}
                            <ArrowRight
                                size={17}
                                aria-hidden="true"
                                className="transition-transform duration-200 group-hover:translate-x-1"
                            />
                        </a>
                    </Magnetic>
                    <p className="mt-5 text-sm text-white/60">{t.foot}</p>
                </Reveal>
            </div>
        </section>
    );
}
