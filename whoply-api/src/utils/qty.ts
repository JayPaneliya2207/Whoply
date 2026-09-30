/**
 * Line quantities. Goods sold loose — by weight or measure (kg, g, litre, ml,
 * metre…) — may be fractional (2.5 kg of sugar); everything else (pcs, box,
 * packet, dozen…) is counted in whole numbers. The app applies the same rule
 * (whoply-app src/lib/qty.ts) — change both together.
 */
import { AppError } from './AppError.js';

const LOOSE_UNITS = new Set([
    'kg', 'kgs', 'kilo', 'kilogram', 'kilograms', 'g', 'gm', 'gms', 'gr', 'gram', 'grams', 'quintal', 'qtl', 'ton', 'tonne',
    'l', 'lt', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters', 'ml',
    'm', 'mtr', 'mtrs', 'metre', 'metres', 'meter', 'meters', 'cm', 'ft', 'feet', 'yard', 'yd', 'sqft', 'sq ft', 'sq.ft',
]);

/** True when the unit is a weight or measure, so a fractional quantity makes sense. */
export const isLooseUnit = (unit?: string) => LOOSE_UNITS.has(String(unit ?? '').trim().toLowerCase().replace(/\.$/, ''));

/** Validate one line's quantity for a product; returns it rounded to at most 3 decimals. */
export function lineQty(raw: unknown, p: { name: string; unit?: string }): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw AppError.badRequest(`Enter a quantity above 0 for ${p.name}`);
    const q = Math.round(n * 1000) / 1000;
    if (!isLooseUnit(p.unit) && !Number.isInteger(q)) {
        throw AppError.badRequest(`${p.name} is sold in ${p.unit || 'pcs'} — enter a whole number`);
    }
    return q;
}
