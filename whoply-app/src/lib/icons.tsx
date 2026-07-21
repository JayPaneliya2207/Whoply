/**
 * Category → emoji icon mapping. Categories are user-created, so we match on
 * keywords in the name and fall back to a generic box.
 */
const RULES: [RegExp, string][] = [
    [/jewell?ery|jewel|bangle|necklace|imitation/i, '💍'],
    [/toy/i, '🧸'],
    [/cutlery|spoon|plate|steel|kitchen/i, '🍴'],
    [/undergarment|innerwear|vest|briefs?/i, '🩲'],
    [/saree|sari/i, '🥻'],
    [/kurti|dress|apparel|cloth|garment|fashion/i, '👗'],
    [/grocer|dal|rice|oil|sugar|atta|flour/i, '🛒'],
    [/baker|bread|biscuit|rusk|cake/i, '🍞'],
    [/namkeen|snack|bhujia|sev|mixture/i, '🍿'],
    [/cosmetic|beauty|soap|shampoo/i, '🧴'],
    [/medicine|pharma|drug/i, '💊'],
    [/electronic|mobile|charger|cable/i, '🔌'],
    [/stationery|pen|book|paper/i, '✏️'],
    [/beverage|drink|juice|cola|water/i, '🥤'],
    [/dairy|milk|curd|paneer|ghee/i, '🥛'],
];

export const catEmoji = (name?: string): string => {
    if (!name) return '📦';
    for (const [re, emoji] of RULES) if (re.test(name)) return emoji;
    return '📦';
};

/** Small rounded icon tile used across products / POS / lists. */
export function CatIcon({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'h-11 w-11 text-2xl' : size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-lg';
    return (
        <div className={`${dims} grid place-items-center rounded-xl shrink-0`} style={{ background: 'var(--brand-100)' }}>
            <span>{catEmoji(name)}</span>
        </div>
    );
}
