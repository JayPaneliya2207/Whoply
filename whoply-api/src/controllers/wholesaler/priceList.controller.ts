import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { businessOf } from '../../utils/http.js';
import Product from '../../models/Product.js';
import PriceList from '../../models/PriceList.js';
import type { AuthRequest } from '../../interfaces/index.js';

/** Suggested tier multipliers off the base: Premium (best) < Standard < Basic (small buyers). */
const TIER_MULT: Record<'A' | 'B' | 'C', number> = { A: 0.95, B: 1.0, C: 1.06 };

/** GET /price-lists — products with their A/B/C tier prices merged in.
 * Any product missing a tier price gets one auto-filled from the base so the
 * wholesaler starts with sensible prices to review & tweak (not blank rows). */
export const getPriceList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const [products, rows] = await Promise.all([
        Product.find({ businessId, isActive: true }).sort({ name: 1 }).lean(),
        PriceList.find({ businessId }).lean(),
    ]);
    const byProduct = new Map<string, any>();
    rows.forEach((r) => {
        const key = String(r.productId);
        if (!byProduct.has(key)) byProduct.set(key, {});
        byProduct.get(key)[r.tier] = r.price;
    });

    // Auto-fill any missing tiers (idempotent, safe against races via upsert + $setOnInsert).
    const toUpsert: any[] = [];
    for (const p of products) {
        const base = p.wholesalePrice || p.sellPrice || 0;
        if (base <= 0) continue;
        const key = String(p._id);
        const tiers = byProduct.get(key) || {};
        (['A', 'B', 'C'] as const).forEach((tier) => {
            if (tiers[tier] == null) {
                const price = Math.round(base * TIER_MULT[tier]);
                tiers[tier] = price;
                toUpsert.push({ updateOne: { filter: { businessId, productId: p._id, tier }, update: { $setOnInsert: { price } }, upsert: true } });
            }
        });
        byProduct.set(key, tiers);
    }
    if (toUpsert.length) await PriceList.bulkWrite(toUpsert);

    const items = products.map((p) => {
        const tiers = byProduct.get(String(p._id)) || {};
        return {
            productId: p._id,
            name: p.name,
            unit: p.unit,
            base: p.wholesalePrice || p.sellPrice,
            A: tiers.A ?? null,
            B: tiers.B ?? null,
            C: tiers.C ?? null,
        };
    });
    sendSuccess(res, items);
});

/** PUT /price-lists — upsert a tier price for a product */
export const setPrice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const businessId = businessOf(req);
    const { productId, tier, price } = req.body;
    if (!productId || !['A', 'B', 'C'].includes(tier) || price == null) {
        throw AppError.badRequest('productId, tier (A/B/C) and price are required');
    }
    const row = await PriceList.findOneAndUpdate(
        { businessId, productId, tier },
        { price: Number(price) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    sendCreated(res, row, 'Price saved');
});
