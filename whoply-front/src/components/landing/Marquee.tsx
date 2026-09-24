import { getCopy, type Lang } from '@/i18n/landing';

/**
 * Capability ticker, two rows running opposite ways. Deliberately states what
 * Whoply *does* rather than traction numbers — see landing-content.md §22.
 * The second row repeats the feature names, so it's hidden from readers.
 */
export function Marquee({ lang }: { lang: Lang }) {
    const t = getCopy(lang);
    const { items, label } = t.marquee;
    const features = t.features.cards.map((c) => c.title);

    return (
        <div className="border-y border-border bg-navy-tint py-3">
            <Row items={items} label={label} />
            <Row items={features} reverse decorative />
        </div>
    );
}

function Row({
    items,
    label,
    reverse = false,
    decorative = false,
}: {
    items: string[];
    label?: string;
    reverse?: boolean;
    decorative?: boolean;
}) {
    return (
        <div
            className="flex overflow-hidden py-1.5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
            role={decorative ? undefined : 'list'}
            aria-label={decorative ? undefined : label}
            aria-hidden={decorative || undefined}
        >
            {[0, 1].map((copy) => (
                <div
                    key={copy}
                    aria-hidden={copy === 1 || undefined}
                    className={`flex shrink-0 items-center gap-10 pr-10 motion-reduce:animate-none ${
                        reverse ? 'animate-marquee-rev' : 'animate-marquee'
                    }`}
                >
                    {items.map((item) => (
                        <span
                            key={item}
                            role={copy === 0 && !decorative ? 'listitem' : undefined}
                            className={`flex items-center gap-3 whitespace-nowrap text-sm font-semibold ${
                                reverse ? 'text-muted' : 'text-navy'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${reverse ? 'bg-sand' : 'bg-accent-bright'}`} />
                            {item}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}
