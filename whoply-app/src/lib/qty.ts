/**
 * Quantities — same rule as whoply-api src/utils/qty.ts (change both together):
 * goods sold loose by weight or measure (kg, g, litre, ml, metre…) may be
 * fractional (2.5 kg); everything else (pcs, box, packet…) is whole numbers.
 */

const LOOSE_UNITS = new Set([
    'kg', 'kgs', 'kilo', 'kilogram', 'kilograms', 'g', 'gm', 'gms', 'gr', 'gram', 'grams', 'quintal', 'qtl', 'ton', 'tonne',
    'l', 'lt', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters', 'ml',
    'm', 'mtr', 'mtrs', 'metre', 'metres', 'meter', 'meters', 'cm', 'ft', 'feet', 'yard', 'yd', 'sqft', 'sq ft', 'sq.ft',
]);

/** True when the unit is a weight or measure, so a fractional quantity makes sense. */
export const isLooseUnit = (unit?: string) => LOOSE_UNITS.has(String(unit ?? '').trim().toLowerCase().replace(/\.$/, ''));

/** A typed quantity made valid for the unit: whole for pieces, ≤ 3 decimals for loose goods. */
export const cleanQty = (n: number, unit?: string) => (isLooseUnit(unit) ? Math.round(n * 1000) / 1000 : Math.round(n));

/**
 * `qty + delta` for the − / + buttons: rounded for the unit, never below the
 * smallest sensible amount (so − on 0.5 kg doesn't jump up to 1) and never
 * above `max` (stock) when given.
 */
export const stepQty = (qty: number, delta: number, unit?: string, max?: number) => {
    const next = cleanQty(qty + delta, unit);
    if (next <= 0) return qty;
    return max != null ? Math.min(next, max) : next;
};
